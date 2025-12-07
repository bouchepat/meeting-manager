import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TranscriptSegment, Meeting, SpeakerMapping, MeetingSummary, Task } from '../entities';
import { TranscriptionGateway } from './transcription.gateway';
import { TranscriptionService } from './transcription.service';
import { GoogleSpeechService } from './google-speech.service';
import { DeepgramService } from './deepgram.service';
import { SpeakerEnrollmentService } from './speaker-enrollment.service';
import { BatchDiarizationService } from './batch-diarization.service';
import { SummarizationService } from './summarization.service';
import { FfmpegService } from '../common/ffmpeg.service';

@Module({
  imports: [TypeOrmModule.forFeature([TranscriptSegment, Meeting, SpeakerMapping, MeetingSummary, Task])],
  providers: [
    TranscriptionGateway,
    TranscriptionService,
    GoogleSpeechService,
    DeepgramService,
    SpeakerEnrollmentService,
    BatchDiarizationService,
    SummarizationService,
    FfmpegService,
  ],
  exports: [TranscriptionService, SpeakerEnrollmentService, BatchDiarizationService, SummarizationService, DeepgramService],
})
export class TranscriptionModule {}
