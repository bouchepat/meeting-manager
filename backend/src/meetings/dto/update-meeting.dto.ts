import { IsEnum, IsOptional, IsString, IsNumber } from 'class-validator';
import { MeetingStatus } from '../../entities/meeting.entity';

export class UpdateMeetingDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(MeetingStatus)
  @IsOptional()
  status?: MeetingStatus;

  @IsString()
  @IsOptional()
  recordingUrl?: string;

  @IsNumber()
  @IsOptional()
  recordingDuration?: number;
}
