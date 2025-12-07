import { IsOptional, IsString, IsBoolean, IsIn } from 'class-validator';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  displayName?: string;

  @IsString()
  @IsOptional()
  photoURL?: string;

  @IsBoolean()
  @IsOptional()
  enableTranscription?: boolean;

  @IsBoolean()
  @IsOptional()
  autoSaveRecordings?: boolean;

  @IsBoolean()
  @IsOptional()
  notificationsEnabled?: boolean;

  @IsString()
  @IsOptional()
  @IsIn(['dark', 'light'])
  theme?: string;

  @IsString()
  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  audioQuality?: string;
}
