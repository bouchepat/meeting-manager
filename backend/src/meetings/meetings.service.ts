import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Meeting, MeetingStatus } from '../entities/meeting.entity';
import { Guest } from '../entities/guest.entity';
import { MeetingSummary } from '../entities/meeting-summary.entity';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { AddGuestDto } from './dto/add-guest.dto';
import { CreateSummaryDto } from './dto/create-summary.dto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class MeetingsService {
  private readonly logger = new Logger(MeetingsService.name);

  constructor(
    @InjectRepository(Meeting)
    private meetingsRepository: Repository<Meeting>,
    @InjectRepository(Guest)
    private guestsRepository: Repository<Guest>,
    @InjectRepository(MeetingSummary)
    private summariesRepository: Repository<MeetingSummary>,
  ) {}

  async create(createMeetingDto: CreateMeetingDto): Promise<Meeting> {
    const meeting = this.meetingsRepository.create({
      ...createMeetingDto,
      status: MeetingStatus.RECORDING,
      startedAt: new Date(),
    });
    return await this.meetingsRepository.save(meeting);
  }

  async findAll(): Promise<Meeting[]> {
    return await this.meetingsRepository.find({
      relations: ['creator', 'guests', 'tasks', 'summaries'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByUser(userId: string): Promise<Meeting[]> {
    return await this.meetingsRepository.find({
      where: { creatorId: userId },
      relations: ['creator', 'guests', 'tasks', 'summaries'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Meeting> {
    const meeting = await this.meetingsRepository.findOne({
      where: { id },
      relations: ['creator', 'guests', 'tasks', 'tasks.assignee', 'summaries'],
    });
    if (!meeting) {
      throw new NotFoundException(`Meeting with ID ${id} not found`);
    }
    return meeting;
  }

  async update(id: string, updateMeetingDto: UpdateMeetingDto): Promise<Meeting> {
    await this.meetingsRepository.update(id, updateMeetingDto);
    return this.findOne(id);
  }

  async endMeeting(id: string): Promise<Meeting> {
    await this.meetingsRepository.update(id, {
      status: MeetingStatus.PROCESSING,
      endedAt: new Date(),
    });
    return this.findOne(id);
  }

  async addGuest(meetingId: string, addGuestDto: AddGuestDto): Promise<Guest> {
    const meeting = await this.findOne(meetingId);
    const guest = this.guestsRepository.create({
      ...addGuestDto,
      meetingId: meeting.id,
    });
    return await this.guestsRepository.save(guest);
  }

  async addSummary(meetingId: string, createSummaryDto: CreateSummaryDto): Promise<MeetingSummary> {
    const meeting = await this.findOne(meetingId);
    const summary = this.summariesRepository.create({
      ...createSummaryDto,
      meetingId: meeting.id,
    });
    const savedSummary = await this.summariesRepository.save(summary);

    // Update meeting status to completed
    await this.meetingsRepository.update(meetingId, {
      status: MeetingStatus.COMPLETED,
    });

    return savedSummary;
  }

  async getSummary(meetingId: string): Promise<MeetingSummary | null> {
    return await this.summariesRepository.findOne({
      where: { meetingId },
      order: { createdAt: 'DESC' },
    });
  }

  async remove(id: string): Promise<void> {
    // First, get the meeting to find the recording file
    const meeting = await this.meetingsRepository.findOne({ where: { id } });
    if (!meeting) {
      throw new NotFoundException(`Meeting with ID ${id} not found`);
    }

    // Delete the audio file if it exists
    if (meeting.recordingUrl) {
      try {
        // recordingUrl is like "/uploads/audio/audio-123456.m4a"
        const fileName = path.basename(meeting.recordingUrl);
        const filePath = path.join(process.cwd(), 'uploads', 'audio', fileName);

        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          this.logger.log(`Deleted audio file: ${fileName}`);
        }
      } catch (error) {
        this.logger.error(`Failed to delete audio file: ${error.message}`);
        // Continue with database deletion even if file deletion fails
      }
    }

    // Delete the meeting from database (cascades to related entities)
    await this.meetingsRepository.delete(id);
    this.logger.log(`Deleted meeting: ${id}`);
  }
}
