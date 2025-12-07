import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SpeechClient, protos } from '@google-cloud/speech';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';

type IStreamingRecognitionResult = protos.google.cloud.speech.v1.IStreamingRecognitionResult;
type IWordInfo = protos.google.cloud.speech.v1.IWordInfo;

export interface TranscriptResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  speakerTag: number;
  startTime: number;
  endTime: number;
  words: Array<{
    word: string;
    speakerTag: number;
    startTime: number;
    endTime: number;
  }>;
}

export interface StreamSession {
  id: string;
  meetingId: string;
  recognizeStream: any;
  emitter: EventEmitter;
  isActive: boolean;
  restartCount: number;
  audioInputStreamTimestamp: number;
}

@Injectable()
export class GoogleSpeechService implements OnModuleInit {
  private readonly logger = new Logger(GoogleSpeechService.name);
  private speechClient: SpeechClient | null = null;
  private sessions: Map<string, StreamSession> = new Map();
  private isConfigured = false;

  // Configuration
  private readonly sampleRateHertz = 16000;
  private readonly languageCode = 'en-US';
  private readonly minSpeakerCount = 1;
  private readonly maxSpeakerCount = 2;

  // Streaming limits (Google has a 5-minute limit per stream)
  private readonly streamingLimit = 290000; // ~4.8 minutes to be safe

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.initializeClient();
  }

  private async initializeClient(): Promise<void> {
    const credentialsPath = this.configService.get<string>('GOOGLE_APPLICATION_CREDENTIALS') ||
      path.join(process.cwd(), 'google-credentials.json');

    if (fs.existsSync(credentialsPath)) {
      try {
        this.speechClient = new SpeechClient({
          keyFilename: credentialsPath,
        });
        this.isConfigured = true;
        this.logger.log('Google Speech client initialized successfully');
      } catch (error) {
        this.logger.error('Failed to initialize Google Speech client:', error);
        this.isConfigured = false;
      }
    } else {
      this.logger.warn(
        `Google credentials not found at ${credentialsPath}. ` +
        'Real-time transcription will not be available. ' +
        'Set GOOGLE_APPLICATION_CREDENTIALS environment variable or place google-credentials.json in the backend root.'
      );
      this.isConfigured = false;
    }
  }

  isAvailable(): boolean {
    return this.isConfigured && this.speechClient !== null;
  }

  createStreamSession(sessionId: string, meetingId: string): StreamSession | null {
    if (!this.isAvailable()) {
      this.logger.warn('Google Speech is not configured. Cannot create stream session.');
      return null;
    }

    const emitter = new EventEmitter();
    const session: StreamSession = {
      id: sessionId,
      meetingId,
      recognizeStream: null,
      emitter,
      isActive: false,
      restartCount: 0,
      audioInputStreamTimestamp: Date.now(),
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  startStreaming(sessionId: string): EventEmitter | null {
    const session = this.sessions.get(sessionId);
    if (!session || !this.speechClient) {
      return null;
    }

    this.createRecognizeStream(session);
    return session.emitter;
  }

  private createRecognizeStream(session: StreamSession): void {
    const request = {
      config: {
        encoding: 'LINEAR16' as const,
        sampleRateHertz: this.sampleRateHertz,
        languageCode: this.languageCode,
        enableAutomaticPunctuation: true,
        enableWordTimeOffsets: true,
        // Use diarizationConfig object (not flat enableSpeakerDiarization)
        diarizationConfig: {
          enableSpeakerDiarization: true,
          minSpeakerCount: this.minSpeakerCount,
          maxSpeakerCount: this.maxSpeakerCount,
        },
        model: 'latest_long',
        useEnhanced: true,
      },
      interimResults: true,
    };

    session.recognizeStream = this.speechClient!
      .streamingRecognize(request)
      .on('error', (error: Error) => {
        this.logger.error(`Stream error for session ${session.id}:`, error.message);

        // Check if it's a timeout error that requires restart
        if (error.message.includes('exceeded') || error.message.includes('timeout')) {
          this.restartStream(session);
        } else {
          session.emitter.emit('error', error);
        }
      })
      .on('data', (data: any) => {
        this.handleStreamData(session, data);
      })
      .on('end', () => {
        this.logger.log(`Stream ended for session ${session.id}`);
        session.isActive = false;
      });

    session.isActive = true;
    session.audioInputStreamTimestamp = Date.now();
    this.logger.log(`Started recognition stream for session ${session.id}`);
  }

  private handleStreamData(session: StreamSession, data: any): void {
    if (!data.results || data.results.length === 0) {
      return;
    }

    const result: IStreamingRecognitionResult = data.results[0];
    if (!result.alternatives || result.alternatives.length === 0) {
      return;
    }

    const alternative = result.alternatives[0];
    const isFinal = result.isFinal || false;

    // Process words with speaker tags
    const words: TranscriptResult['words'] = [];
    let startTime = 0;
    let endTime = 0;
    const speakerTagCounts: Map<number, number> = new Map();

    if (alternative.words && alternative.words.length > 0) {
      for (const wordInfo of alternative.words as IWordInfo[]) {
        const wordStartTime = this.durationToSeconds(wordInfo.startTime);
        const wordEndTime = this.durationToSeconds(wordInfo.endTime);
        const wordSpeakerTag = wordInfo.speakerTag || 1;

        words.push({
          word: wordInfo.word || '',
          speakerTag: wordSpeakerTag,
          startTime: wordStartTime,
          endTime: wordEndTime,
        });

        // Count speaker tags to find the most common one
        speakerTagCounts.set(wordSpeakerTag, (speakerTagCounts.get(wordSpeakerTag) || 0) + 1);

        // Track start/end times
        if (startTime === 0) startTime = wordStartTime;
        endTime = wordEndTime;
      }
    }

    // Use the most common speaker tag in the segment (more accurate for diarization)
    let speakerTag = 1;
    let maxCount = 0;
    for (const [tag, count] of speakerTagCounts) {
      if (count > maxCount) {
        maxCount = count;
        speakerTag = tag;
      }
    }

    const transcriptResult: TranscriptResult = {
      transcript: alternative.transcript || '',
      confidence: alternative.confidence || 0,
      isFinal,
      speakerTag,
      startTime,
      endTime,
      words,
    };

    session.emitter.emit('transcript', transcriptResult);

    if (isFinal) {
      // Log speaker tag distribution for debugging diarization
      const tagDistribution = Object.fromEntries(speakerTagCounts);
      this.logger.log(
        `Final transcript for session ${session.id}: "${transcriptResult.transcript}" ` +
        `(Speaker ${speakerTag}, distribution: ${JSON.stringify(tagDistribution)})`
      );
    }
  }

  private durationToSeconds(duration: any): number {
    if (!duration) return 0;
    const seconds = parseInt(duration.seconds || '0', 10);
    const nanos = parseInt(duration.nanos || '0', 10);
    return seconds + nanos / 1e9;
  }

  private restartStream(session: StreamSession): void {
    // Prevent multiple concurrent restarts
    if (!session.isActive) {
      return;
    }

    session.restartCount++;
    session.isActive = false; // Prevent writes during restart
    this.logger.log(`Restarting stream for session ${session.id} (restart #${session.restartCount})`);

    if (session.recognizeStream) {
      try {
        session.recognizeStream.end();
      } catch (e) {
        // Ignore errors when ending stream
      }
      session.recognizeStream = null;
    }

    // Small delay before restarting
    setTimeout(() => {
      if (this.sessions.has(session.id)) {
        this.createRecognizeStream(session);
        session.emitter.emit('restarted');
      }
    }, 100);
  }

  writeAudio(sessionId: string, audioData: Buffer): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !session.recognizeStream || !session.isActive) {
      return false;
    }

    // Check if the stream is writable before writing
    if (session.recognizeStream.destroyed || session.recognizeStream.writableEnded) {
      this.logger.warn(`Stream for session ${sessionId} is not writable, skipping audio chunk`);
      return false;
    }

    // Check if we need to restart due to streaming limit
    const elapsedTime = Date.now() - session.audioInputStreamTimestamp;
    if (elapsedTime > this.streamingLimit) {
      this.restartStream(session);
      return true; // Audio will be processed after restart
    }

    try {
      session.recognizeStream.write(audioData);
      return true;
    } catch (error: any) {
      // Handle "write after destroy" error gracefully
      if (error.message?.includes('write after') || error.message?.includes('destroyed')) {
        this.logger.warn(`Stream write failed for session ${sessionId}: ${error.message}`);
        // Try to restart the stream
        this.restartStream(session);
        return false;
      }
      this.logger.error(`Error writing audio for session ${sessionId}:`, error);
      return false;
    }
  }

  stopStreaming(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    this.logger.log(`Stopping stream for session ${sessionId}`);

    if (session.recognizeStream) {
      session.recognizeStream.end();
    }

    session.isActive = false;
    session.emitter.emit('stopped');
  }

  destroySession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.stopStreaming(sessionId);
      session.emitter.removeAllListeners();
      this.sessions.delete(sessionId);
      this.logger.log(`Destroyed session ${sessionId}`);
    }
  }

  getSession(sessionId: string): StreamSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Batch transcription for uploaded audio files using longRunningRecognize
   * Supports speaker diarization for longer audio
   */
  async transcribeFile(audioFilePath: string, options?: {
    minSpeakerCount?: number;
    maxSpeakerCount?: number;
  }): Promise<{
    transcript: string;
    segments: Array<{
      transcript: string;
      speakerTag: number;
      startTime: number;
      endTime: number;
      confidence: number;
    }>;
  }> {
    if (!this.isAvailable()) {
      throw new Error('Google Speech is not configured');
    }

    const minSpeakers = options?.minSpeakerCount || this.minSpeakerCount;
    const maxSpeakers = options?.maxSpeakerCount || this.maxSpeakerCount;

    this.logger.log(`Starting batch transcription for file: ${path.basename(audioFilePath)}`);

    // Read the audio file
    const audioContent = fs.readFileSync(audioFilePath);
    const audioBytes = audioContent.toString('base64');

    // For files longer than ~1 minute, use longRunningRecognize
    // For shorter files, use synchronous recognize
    const fileSizeBytes = audioContent.length;
    const isLongAudio = fileSizeBytes > 1024 * 1024; // > 1MB likely > 1 min

    const config: protos.google.cloud.speech.v1.IRecognitionConfig = {
      encoding: protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding.LINEAR16,
      sampleRateHertz: this.sampleRateHertz,
      languageCode: this.languageCode,
      enableAutomaticPunctuation: true,
      enableWordTimeOffsets: true,
      diarizationConfig: {
        enableSpeakerDiarization: true,
        minSpeakerCount: minSpeakers,
        maxSpeakerCount: maxSpeakers,
      },
      model: 'latest_long',
      useEnhanced: true,
    };

    const audio: protos.google.cloud.speech.v1.IRecognitionAudio = {
      content: audioBytes,
    };

    try {
      let response: protos.google.cloud.speech.v1.ILongRunningRecognizeResponse;

      if (isLongAudio) {
        // Use long-running recognize for longer audio
        this.logger.log('Using longRunningRecognize for larger file...');
        const [operation] = await this.speechClient!.longRunningRecognize({
          config,
          audio,
        });

        // Wait for the operation to complete
        const [result] = await operation.promise();
        response = result;
      } else {
        // Use synchronous recognize for shorter audio
        this.logger.log('Using synchronous recognize for smaller file...');
        const [result] = await this.speechClient!.recognize({
          config,
          audio,
        });
        response = result as protos.google.cloud.speech.v1.ILongRunningRecognizeResponse;
      }

      // Process the results
      const segments: Array<{
        transcript: string;
        speakerTag: number;
        startTime: number;
        endTime: number;
        confidence: number;
      }> = [];

      let fullTranscript = '';

      if (response.results && response.results.length > 0) {
        // The last result contains the complete diarization info
        const lastResult = response.results[response.results.length - 1];
        const alternative = lastResult.alternatives?.[0];

        if (alternative?.words && alternative.words.length > 0) {
          // Group words by speaker
          let currentSegment: {
            words: string[];
            speakerTag: number;
            startTime: number;
            endTime: number;
          } | null = null;

          for (const wordInfo of alternative.words) {
            const word = wordInfo.word || '';
            const speakerTag = wordInfo.speakerTag || 1;
            const startTime = this.durationToSeconds(wordInfo.startTime);
            const endTime = this.durationToSeconds(wordInfo.endTime);

            if (!currentSegment || currentSegment.speakerTag !== speakerTag) {
              // Save previous segment
              if (currentSegment) {
                segments.push({
                  transcript: currentSegment.words.join(' '),
                  speakerTag: currentSegment.speakerTag,
                  startTime: currentSegment.startTime,
                  endTime: currentSegment.endTime,
                  confidence: alternative.confidence || 0,
                });
              }

              // Start new segment
              currentSegment = {
                words: [word],
                speakerTag,
                startTime,
                endTime,
              };
            } else {
              // Continue current segment
              currentSegment.words.push(word);
              currentSegment.endTime = endTime;
            }
          }

          // Don't forget the last segment
          if (currentSegment) {
            segments.push({
              transcript: currentSegment.words.join(' '),
              speakerTag: currentSegment.speakerTag,
              startTime: currentSegment.startTime,
              endTime: currentSegment.endTime,
              confidence: alternative.confidence || 0,
            });
          }

          fullTranscript = alternative.transcript || segments.map(s => s.transcript).join(' ');
        } else {
          // No word-level info, use transcript directly
          for (const result of response.results) {
            const alt = result.alternatives?.[0];
            if (alt?.transcript) {
              fullTranscript += alt.transcript + ' ';
              segments.push({
                transcript: alt.transcript,
                speakerTag: 1,
                startTime: 0,
                endTime: 0,
                confidence: alt.confidence || 0,
              });
            }
          }
          fullTranscript = fullTranscript.trim();
        }
      }

      // Log speaker distribution
      const speakerCounts = new Map<number, number>();
      segments.forEach(s => {
        speakerCounts.set(s.speakerTag, (speakerCounts.get(s.speakerTag) || 0) + 1);
      });
      this.logger.log(
        `Batch transcription complete: ${segments.length} segments, ` +
        `speakers: ${JSON.stringify(Object.fromEntries(speakerCounts))}`
      );

      return {
        transcript: fullTranscript,
        segments,
      };
    } catch (error: any) {
      this.logger.error(`Batch transcription failed: ${error.message}`);
      throw error;
    }
  }
}
