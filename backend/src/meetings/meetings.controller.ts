import { Controller, Get, Post, Body, Patch, Param, Delete, HttpCode, HttpStatus, ForbiddenException, BadRequestException } from '@nestjs/common';
import { MeetingsService } from './meetings.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { AddGuestDto } from './dto/add-guest.dto';
import { CreateSummaryDto } from './dto/create-summary.dto';
import { TranscriptionService } from '../transcription/transcription.service';
import { SpeakerEnrollmentService } from '../transcription/speaker-enrollment.service';
import { SummarizationService } from '../transcription/summarization.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../entities/user.entity';

@Controller('meetings')
export class MeetingsController {
  constructor(
    private readonly meetingsService: MeetingsService,
    private readonly transcriptionService: TranscriptionService,
    private readonly speakerEnrollmentService: SpeakerEnrollmentService,
    private readonly summarizationService: SummarizationService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: User, @Body() createMeetingDto: CreateMeetingDto) {
    // Set the creator to the current user
    return this.meetingsService.create({
      ...createMeetingDto,
      creatorId: user.id,
    });
  }

  @Get()
  findAll(@CurrentUser() user: User) {
    // Only return meetings owned by the current user
    return this.meetingsService.findByUser(user.id);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: User, @Param('id') id: string) {
    const meeting = await this.meetingsService.findOne(id);
    // Verify ownership
    if (meeting.creatorId !== user.id) {
      throw new ForbiddenException('You do not have access to this meeting');
    }
    return meeting;
  }

  @Patch(':id')
  async update(@CurrentUser() user: User, @Param('id') id: string, @Body() updateMeetingDto: UpdateMeetingDto) {
    // Verify ownership before update
    const meeting = await this.meetingsService.findOne(id);
    if (meeting.creatorId !== user.id) {
      throw new ForbiddenException('You do not have access to this meeting');
    }
    return this.meetingsService.update(id, updateMeetingDto);
  }

  @Post(':id/end')
  async endMeeting(@CurrentUser() user: User, @Param('id') id: string) {
    // Verify ownership before ending
    const meeting = await this.meetingsService.findOne(id);
    if (meeting.creatorId !== user.id) {
      throw new ForbiddenException('You do not have access to this meeting');
    }
    return this.meetingsService.endMeeting(id);
  }

  @Post(':id/guests')
  @HttpCode(HttpStatus.CREATED)
  async addGuest(@CurrentUser() user: User, @Param('id') id: string, @Body() addGuestDto: AddGuestDto) {
    // Verify ownership before adding guest
    const meeting = await this.meetingsService.findOne(id);
    if (meeting.creatorId !== user.id) {
      throw new ForbiddenException('You do not have access to this meeting');
    }
    return this.meetingsService.addGuest(id, addGuestDto);
  }

  @Post(':id/summary')
  @HttpCode(HttpStatus.CREATED)
  async addSummary(@CurrentUser() user: User, @Param('id') id: string, @Body() createSummaryDto: CreateSummaryDto) {
    // Verify ownership before adding summary
    const meeting = await this.meetingsService.findOne(id);
    if (meeting.creatorId !== user.id) {
      throw new ForbiddenException('You do not have access to this meeting');
    }
    return this.meetingsService.addSummary(id, createSummaryDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: User, @Param('id') id: string) {
    // Verify ownership before delete
    const meeting = await this.meetingsService.findOne(id);
    if (meeting.creatorId !== user.id) {
      throw new ForbiddenException('You do not have access to this meeting');
    }
    return this.meetingsService.remove(id);
  }

  @Get(':id/transcript')
  async getTranscript(@CurrentUser() user: User, @Param('id') id: string) {
    // Verify ownership before getting transcript
    const meeting = await this.meetingsService.findOne(id);
    if (meeting.creatorId !== user.id) {
      throw new ForbiddenException('You do not have access to this meeting');
    }
    return this.transcriptionService.getFinalSegmentsByMeeting(id);
  }

  @Get(':id/transcript/full')
  async getFullTranscript(@CurrentUser() user: User, @Param('id') id: string) {
    // Verify ownership before getting full transcript
    const meeting = await this.meetingsService.findOne(id);
    if (meeting.creatorId !== user.id) {
      throw new ForbiddenException('You do not have access to this meeting');
    }
    return this.transcriptionService.generateFullTranscript(id);
  }

  // Speaker mapping endpoints
  @Get(':id/speakers')
  async getSpeakers(@CurrentUser() user: User, @Param('id') id: string) {
    // Verify ownership
    const meeting = await this.meetingsService.findOne(id);
    if (meeting.creatorId !== user.id) {
      throw new ForbiddenException('You do not have access to this meeting');
    }
    const mappings = await this.speakerEnrollmentService.getSpeakerMappings(id);
    // Convert Map to array of objects for JSON serialization
    return Array.from(mappings.entries()).map(([speakerTag, speakerName]) => ({
      speakerTag,
      speakerName,
    }));
  }

  @Post(':id/speakers')
  @HttpCode(HttpStatus.OK)
  async setSpeaker(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: { speakerTag: number; speakerName: string },
  ) {
    // Verify ownership
    const meeting = await this.meetingsService.findOne(id);
    if (meeting.creatorId !== user.id) {
      throw new ForbiddenException('You do not have access to this meeting');
    }
    return this.speakerEnrollmentService.saveSpeakerMapping(id, body.speakerTag, body.speakerName);
  }

  // AI Summarization endpoints
  @Post(':id/summarize')
  @HttpCode(HttpStatus.OK)
  async generateAiSummary(@CurrentUser() user: User, @Param('id') id: string) {
    // Verify ownership
    const meeting = await this.meetingsService.findOne(id);
    if (meeting.creatorId !== user.id) {
      throw new ForbiddenException('You do not have access to this meeting');
    }

    if (!this.summarizationService.isAvailable()) {
      throw new BadRequestException('AI summarization service is not available. Please configure OPENAI_API_KEY.');
    }

    // Generate summary and tasks
    const result = await this.summarizationService.processPostMeeting(id);
    return {
      summary: result.summary,
      tasksCreated: result.tasks.length,
      tasks: result.tasks,
    };
  }

  @Get(':id/ai-summary')
  async getAiSummary(@CurrentUser() user: User, @Param('id') id: string) {
    // Verify ownership
    const meeting = await this.meetingsService.findOne(id);
    if (meeting.creatorId !== user.id) {
      throw new ForbiddenException('You do not have access to this meeting');
    }
    return this.meetingsService.getSummary(id);
  }
}
