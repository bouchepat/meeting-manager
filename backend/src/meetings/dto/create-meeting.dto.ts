import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateMeetingDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID()
  @IsNotEmpty()
  creatorId: string;
}
