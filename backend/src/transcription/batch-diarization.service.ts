import { Injectable, Logger, Inject, forwardRef, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TranscriptSegment, Meeting } from '../entities';
import { SpeakerEnrollmentService } from './speaker-enrollment.service';
import { FfmpegService } from '../common/ffmpeg.service';
import { GoogleSpeechService } from './google-speech.service';
import { SummarizationService } from './summarization.service';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

interface DiarizedSegment {
  speakerTag: number;
  speaker: string;
  transcript: string;
  startTime: number;
  endTime: number;
  confidence?: number;
}

interface PyannoteSegment {
  speaker: string;
  start: number;
  end: number;
}

@Injectable()
export class BatchDiarizationService implements OnModuleInit {
  private readonly logger = new Logger(BatchDiarizationService.name);
  private diarizationServiceUrl: string | null = null;

  constructor(
    private configService: ConfigService,
    @InjectRepository(TranscriptSegment)
    private segmentRepository: Repository<TranscriptSegment>,
    @InjectRepository(Meeting)
    private meetingRepository: Repository<Meeting>,
    private speakerEnrollmentService: SpeakerEnrollmentService,
    private ffmpegService: FfmpegService,
    private googleSpeechService: GoogleSpeechService,
    @Inject(forwardRef(() => SummarizationService))
    private summarizationService: SummarizationService,
  ) {
    this.diarizationServiceUrl = this.configService.get<string>('DIARIZATION_SERVICE_URL') || null;
  }

  onModuleInit() {
    // Check availability after GoogleSpeechService has initialized
    if (this.googleSpeechService.isAvailable()) {
      this.logger.log('Batch transcription service initialized with Google Cloud Speech-to-Text');
    } else {
      this.logger.warn('Google Speech not available - check GOOGLE_APPLICATION_CREDENTIALS');
    }

    if (this.diarizationServiceUrl) {
      this.logger.log(`Pyannote diarization service configured: ${this.diarizationServiceUrl}`);
    } else {
      this.logger.warn('DIARIZATION_SERVICE_URL not configured - speaker diarization will use Google Speech only');
    }
  }

  isAvailable(): boolean {
    return this.googleSpeechService.isAvailable();
  }

  isDiarizationAvailable(): boolean {
    return this.diarizationServiceUrl !== null;
  }

  /**
   * Process an audio file after recording ends.
   * 1. If live transcription captured segments, run pyannote diarization to assign speakers
   * 2. If no live segments, attempt batch transcription (only works for short audio <1min)
   * 3. Run AI summarization
   */
  async processAudioFile(meetingId: string, audioFilePath: string): Promise<void> {
    this.logger.log(`Starting post-processing for meeting ${meetingId}`);

    let wavFilePath: string | null = null;

    try {
      // Check if we already have transcript segments from live transcription
      const existingSegments = await this.segmentRepository.find({
        where: { meetingId },
        order: { startTime: 'ASC' },
      });

      if (existingSegments.length > 0) {
        this.logger.log(`Meeting ${meetingId} has ${existingSegments.length} segments from live transcription.`);

        // Run pyannote diarization to assign proper speaker tags
        if (this.isDiarizationAvailable()) {
          this.logger.log('Running pyannote diarization on audio file...');

          // Convert to WAV for pyannote
          const ext = path.extname(audioFilePath).toLowerCase();
          if (ext !== '.wav') {
            this.logger.log(`Converting ${ext} to WAV for pyannote...`);
            wavFilePath = await this.ffmpegService.convertToWav(audioFilePath);
          } else {
            wavFilePath = audioFilePath;
          }

          try {
            const diarizationResult = await this.callPyannoteDiarization(wavFilePath);
            this.logger.log(`Pyannote detected ${diarizationResult.num_speakers} speakers`);

            // Update existing segments with speaker assignments and merge consecutive same-speaker segments
            await this.assignSpeakersAndMergeSegments(meetingId, existingSegments, diarizationResult.segments);
          } catch (diarError: any) {
            this.logger.error(`Pyannote diarization failed (continuing with single speaker): ${diarError.message}`);
          }
        } else {
          this.logger.log('Pyannote not configured - keeping existing speaker assignments');
        }

        // Run summarization if available
        if (this.summarizationService.isAvailable()) {
          this.logger.log('Generating meeting summary and tasks...');
          try {
            const postProcessResult = await this.summarizationService.processPostMeeting(meetingId);
            this.logger.log(`Summary generated, ${postProcessResult.tasks.length} tasks created`);
          } catch (summaryError: any) {
            this.logger.error(`Summarization failed (non-fatal): ${summaryError.message}`);
          }
        }

        await this.updateMeetingStatus(meetingId, 'completed');
        return;
      }

      // No live transcription segments - try batch transcription
      if (!this.isAvailable()) {
        this.logger.warn('Batch transcription not available (Google Speech not configured)');
        await this.updateMeetingStatus(meetingId, 'completed');
        return;
      }

      this.logger.log(`No live transcript found. Attempting batch transcription for meeting ${meetingId}`);

      // Convert to WAV (LINEAR16) for Google Speech API
      const ext = path.extname(audioFilePath).toLowerCase();
      if (ext !== '.wav') {
        this.logger.log(`Converting ${ext} to WAV for Google Speech...`);
        wavFilePath = await this.ffmpegService.convertToWav(audioFilePath);
      } else {
        wavFilePath = audioFilePath;
      }

      // Transcribe with Google Speech (includes speaker diarization)
      this.logger.log('Transcribing with Google Cloud Speech-to-Text (with diarization)...');
      const transcription = await this.googleSpeechService.transcribeFile(wavFilePath, {
        minSpeakerCount: 1,
        maxSpeakerCount: 6, // Support up to 6 speakers in a meeting
      });

      this.logger.log(`Google Speech transcription complete: ${transcription.segments.length} segments`);

      // Convert to DiarizedSegment format
      const diarizedSegments: DiarizedSegment[] = transcription.segments.map(seg => ({
        speakerTag: seg.speakerTag,
        speaker: `SPEAKER_${String(seg.speakerTag).padStart(2, '0')}`,
        transcript: seg.transcript.trim(),
        startTime: seg.startTime,
        endTime: seg.endTime,
        confidence: seg.confidence,
      }));

      if (diarizedSegments.length === 0) {
        this.logger.warn(`No segments extracted for meeting ${meetingId}`);
        await this.updateMeetingStatus(meetingId, 'completed');
        return;
      }

      // Get existing speaker mappings from enrollment
      const speakerMappings = await this.speakerEnrollmentService.getSpeakerMappings(meetingId);

      // Update transcript segments in database
      await this.updateTranscriptSegments(meetingId, diarizedSegments, speakerMappings);

      // Generate summary and extract tasks (if summarization service available)
      if (this.summarizationService.isAvailable()) {
        this.logger.log('Generating meeting summary and tasks...');
        try {
          const postProcessResult = await this.summarizationService.processPostMeeting(meetingId);
          this.logger.log(`Summary generated, ${postProcessResult.tasks.length} tasks created`);
        } catch (summaryError: any) {
          this.logger.error(`Summarization failed (non-fatal): ${summaryError.message}`);
        }
      } else {
        this.logger.log('Skipping summarization (service not configured)');
      }

      await this.updateMeetingStatus(meetingId, 'completed');
      this.logger.log(`Batch transcription complete for meeting ${meetingId}: ${diarizedSegments.length} segments`);

    } catch (error: any) {
      this.logger.error(`Post-processing failed for meeting ${meetingId}:`, error.message);
      await this.updateMeetingStatus(meetingId, 'failed');
    } finally {
      // Clean up temporary WAV file
      if (wavFilePath && wavFilePath !== audioFilePath && fs.existsSync(wavFilePath)) {
        try {
          fs.unlinkSync(wavFilePath);
          this.logger.log(`Cleaned up temporary WAV file`);
        } catch (cleanupError: any) {
          this.logger.warn(`Failed to clean up WAV file: ${cleanupError.message}`);
        }
      }
    }
  }

  /**
   * Call pyannote diarization service
   */
  private async callPyannoteDiarization(audioFilePath: string): Promise<{
    segments: PyannoteSegment[];
    num_speakers: number;
  }> {
    const response = await fetch(`${this.diarizationServiceUrl}/diarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_path: audioFilePath }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Diarization service error: ${error}`);
    }

    return response.json();
  }

  /**
   * Assign speakers from pyannote diarization to existing transcript segments
   * and merge consecutive segments from the same speaker
   */
  private async assignSpeakersAndMergeSegments(
    meetingId: string,
    segments: TranscriptSegment[],
    pyannoteSpeakers: PyannoteSegment[],
  ): Promise<void> {
    // Create speaker mapping (SPEAKER_00 -> 1, SPEAKER_01 -> 2, etc.)
    const uniqueSpeakers = [...new Set(pyannoteSpeakers.map(s => s.speaker))].sort();
    const speakerMap = new Map<string, number>();
    uniqueSpeakers.forEach((speaker, index) => {
      speakerMap.set(speaker, index + 1);
    });

    this.logger.log(`Speaker mapping: ${JSON.stringify(Object.fromEntries(speakerMap))}`);

    // Assign speaker to each segment based on midpoint
    const segmentsWithSpeakers = segments.map(segment => {
      const segmentMid = (segment.startTime + segment.endTime) / 2;

      // Find the pyannote segment that contains this midpoint
      let assignedSpeaker = 'SPEAKER_00';
      for (const ps of pyannoteSpeakers) {
        if (ps.start <= segmentMid && segmentMid <= ps.end) {
          assignedSpeaker = ps.speaker;
          break;
        }
      }

      const speakerTag = speakerMap.get(assignedSpeaker) || 1;
      return {
        ...segment,
        speakerTag,
      };
    });

    // Merge consecutive segments from the same speaker
    const mergedSegments: Array<{
      speakerTag: number;
      transcript: string;
      startTime: number;
      endTime: number;
      confidence: number;
    }> = [];

    let current: typeof mergedSegments[0] | null = null;

    for (const segment of segmentsWithSpeakers) {
      if (!current) {
        current = {
          speakerTag: segment.speakerTag,
          transcript: segment.transcript,
          startTime: segment.startTime,
          endTime: segment.endTime,
          confidence: segment.confidence,
        };
      } else if (segment.speakerTag === current.speakerTag) {
        // Same speaker - merge
        current.transcript = current.transcript + ' ' + segment.transcript;
        current.endTime = segment.endTime;
        current.confidence = Math.min(current.confidence, segment.confidence);
      } else {
        // Different speaker - save current and start new
        mergedSegments.push(current);
        current = {
          speakerTag: segment.speakerTag,
          transcript: segment.transcript,
          startTime: segment.startTime,
          endTime: segment.endTime,
          confidence: segment.confidence,
        };
      }
    }

    // Don't forget the last segment
    if (current) {
      mergedSegments.push(current);
    }

    this.logger.log(`Merged ${segments.length} segments into ${mergedSegments.length} segments by speaker`);

    // Delete existing segments and insert merged ones
    await this.segmentRepository.delete({ meetingId });

    for (const segment of mergedSegments) {
      const newSegment = this.segmentRepository.create({
        id: uuidv4(),
        meetingId,
        speakerTag: segment.speakerTag,
        transcript: segment.transcript,
        confidence: segment.confidence,
        startTime: segment.startTime,
        endTime: segment.endTime,
        isFinal: true,
      });

      await this.segmentRepository.save(newSegment);
    }

    this.logger.log(`Saved ${mergedSegments.length} merged segments for meeting ${meetingId}`);
  }

  /**
   * Merge consecutive segments from the same speaker
   */
  private mergeConsecutiveSpeakerSegments(segments: DiarizedSegment[]): DiarizedSegment[] {
    if (segments.length === 0) return [];

    const merged: DiarizedSegment[] = [];
    let current = { ...segments[0] };

    for (let i = 1; i < segments.length; i++) {
      const segment = segments[i];

      if (segment.speakerTag === current.speakerTag) {
        // Same speaker - merge the text and extend the time range
        current.transcript = current.transcript + ' ' + segment.transcript;
        current.endTime = segment.endTime;
      } else {
        // Different speaker - save current and start new
        merged.push(current);
        current = { ...segment };
      }
    }

    // Don't forget the last segment
    merged.push(current);

    return merged;
  }

  /**
   * Update transcript segments in database
   */
  private async updateTranscriptSegments(
    meetingId: string,
    segments: DiarizedSegment[],
    speakerMappings: Map<number, string>,
  ): Promise<void> {
    // Merge consecutive segments from the same speaker
    const mergedSegments = this.mergeConsecutiveSpeakerSegments(segments);
    this.logger.log(`Merged ${segments.length} segments into ${mergedSegments.length} segments`);

    // Delete existing segments for this meeting
    await this.segmentRepository.delete({ meetingId });

    // Insert new segments
    for (const segment of mergedSegments) {
      const speakerName = speakerMappings.get(segment.speakerTag);

      const newSegment = this.segmentRepository.create({
        id: uuidv4(),
        meetingId,
        speakerTag: segment.speakerTag,
        speakerName,
        transcript: segment.transcript,
        confidence: segment.confidence ?? 1.0,
        startTime: segment.startTime,
        endTime: segment.endTime,
        isFinal: true,
      });

      await this.segmentRepository.save(newSegment);
    }

    this.logger.log(`Updated ${mergedSegments.length} segments for meeting ${meetingId}`);
  }

  private async updateMeetingStatus(meetingId: string, status: string): Promise<void> {
    await this.meetingRepository.update(meetingId, { status: status as any });
  }
}
