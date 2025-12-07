import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MeetingsService } from './meetings.service';
import { MeetingsController } from './meetings.controller';
import { Meeting } from '../entities/meeting.entity';
import { Guest } from '../entities/guest.entity';
import { MeetingSummary } from '../entities/meeting-summary.entity';
import { TranscriptionModule } from '../transcription/transcription.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Meeting, Guest, MeetingSummary]),
    TranscriptionModule,
  ],
  controllers: [MeetingsController],
  providers: [MeetingsService],
  exports: [MeetingsService],
})
export class MeetingsModule {}
