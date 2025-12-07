import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SpeakerMapping } from '../entities';
import { v4 as uuidv4 } from 'uuid';
import { extractName, isValidName, NameExtractionResult } from '../utils/name-extractor';

@Injectable()
export class SpeakerEnrollmentService {
  private readonly logger = new Logger(SpeakerEnrollmentService.name);

  constructor(
    @InjectRepository(SpeakerMapping)
    private speakerMappingRepository: Repository<SpeakerMapping>,
  ) {}

  /**
   * Attempts to extract a name from the transcript text
   * Supports both spoken names and spelled names (e.g., "John, J-O-H-N")
   */
  extractNameFromTranscript(transcript: string): NameExtractionResult {
    const result = extractName(transcript);
    this.logger.debug(
      `Name extraction: "${transcript}" -> "${result.name}" (${result.method}, ${result.confidence})`,
    );
    return result;
  }

  /**
   * Validate if a name is acceptable for enrollment
   */
  validateName(name: string): boolean {
    return isValidName(name);
  }

  /**
   * Save or update a speaker mapping
   */
  async saveSpeakerMapping(
    meetingId: string,
    speakerTag: number,
    speakerName: string,
  ): Promise<SpeakerMapping> {
    // Check if mapping already exists
    const existing = await this.speakerMappingRepository.findOne({
      where: { meetingId, speakerTag },
    });

    if (existing) {
      // Update existing mapping
      existing.speakerName = speakerName;
      return this.speakerMappingRepository.save(existing);
    }

    // Create new mapping
    const mapping = this.speakerMappingRepository.create({
      id: uuidv4(),
      meetingId,
      speakerTag,
      speakerName,
    });

    this.logger.log(`Enrolled speaker: ${speakerName} as Speaker ${speakerTag} for meeting ${meetingId}`);
    return this.speakerMappingRepository.save(mapping);
  }

  /**
   * Get all speaker mappings for a meeting
   */
  async getSpeakerMappings(meetingId: string): Promise<Map<number, string>> {
    const mappings = await this.speakerMappingRepository.find({
      where: { meetingId },
    });

    const map = new Map<number, string>();
    for (const mapping of mappings) {
      map.set(mapping.speakerTag, mapping.speakerName);
    }

    return map;
  }

  /**
   * Get speaker name by tag
   */
  async getSpeakerName(meetingId: string, speakerTag: number): Promise<string | null> {
    const mapping = await this.speakerMappingRepository.findOne({
      where: { meetingId, speakerTag },
    });

    return mapping?.speakerName || null;
  }

  /**
   * Delete all speaker mappings for a meeting
   */
  async clearMeetingMappings(meetingId: string): Promise<void> {
    await this.speakerMappingRepository.delete({ meetingId });
  }

  /**
   * Remove a specific speaker mapping
   */
  async removeSpeakerMapping(meetingId: string, speakerTag: number): Promise<void> {
    await this.speakerMappingRepository.delete({ meetingId, speakerTag });
    this.logger.log(`Removed speaker mapping for tag ${speakerTag} in meeting ${meetingId}`);
  }

  /**
   * Check if a speaker tag is already enrolled
   */
  async isSpeakerEnrolled(meetingId: string, speakerTag: number): Promise<boolean> {
    const count = await this.speakerMappingRepository.count({
      where: { meetingId, speakerTag },
    });
    return count > 0;
  }
}
