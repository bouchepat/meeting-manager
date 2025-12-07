import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TranscriptSegment, Meeting } from '../entities';
import { v4 as uuidv4 } from 'uuid';

export interface TranscriptSegmentDto {
  speakerTag: number;
  speakerName?: string;
  transcript: string;
  confidence?: number;
  startTime: number;
  endTime: number;
  isFinal: boolean;
}

@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);

  constructor(
    @InjectRepository(TranscriptSegment)
    private segmentRepository: Repository<TranscriptSegment>,
    @InjectRepository(Meeting)
    private meetingRepository: Repository<Meeting>,
  ) {}

  async saveSegment(meetingId: string, segment: TranscriptSegmentDto): Promise<TranscriptSegment> {
    const newSegment = this.segmentRepository.create({
      id: uuidv4(),
      meetingId,
      ...segment,
    });

    return this.segmentRepository.save(newSegment);
  }

  async updateOrCreateSegment(
    meetingId: string,
    segment: TranscriptSegmentDto,
    existingId?: string,
  ): Promise<TranscriptSegment | null> {
    if (existingId) {
      await this.segmentRepository.update(existingId, segment);
      return this.segmentRepository.findOneBy({ id: existingId });
    }
    return this.saveSegment(meetingId, segment);
  }

  async getSegmentsByMeeting(meetingId: string): Promise<TranscriptSegment[]> {
    return this.segmentRepository.find({
      where: { meetingId },
      order: { startTime: 'ASC' },
    });
  }

  async getFinalSegmentsByMeeting(meetingId: string): Promise<TranscriptSegment[]> {
    return this.segmentRepository.find({
      where: { meetingId, isFinal: true },
      order: { startTime: 'ASC' },
    });
  }

  async deleteInterimSegments(meetingId: string): Promise<void> {
    await this.segmentRepository.delete({ meetingId, isFinal: false });
  }

  async generateFullTranscript(meetingId: string): Promise<string> {
    const segments = await this.getFinalSegmentsByMeeting(meetingId);

    let transcript = '';
    let currentSpeaker = -1;

    for (const segment of segments) {
      if (segment.speakerTag !== currentSpeaker) {
        currentSpeaker = segment.speakerTag;
        const speakerLabel = segment.speakerName || `Speaker ${segment.speakerTag}`;
        transcript += `\n\n[${speakerLabel}]:\n`;
      }
      transcript += segment.transcript + ' ';
    }

    return transcript.trim();
  }

  async updateMeetingTranscript(meetingId: string, transcriptUrl: string): Promise<void> {
    await this.meetingRepository.update(meetingId, { transcriptUrl });
  }
}
