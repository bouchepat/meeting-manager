import { IsNotEmpty, IsOptional, IsString, IsUUID, IsEnum, IsBoolean, IsDateString } from 'class-validator';
import { TaskPriority } from '../../entities/task.entity';

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  @IsDateString()
  @IsOptional()
  dueDate?: Date;

  @IsUUID()
  @IsNotEmpty()
  meetingId: string;

  @IsUUID()
  @IsOptional()
  assigneeId?: string;

  @IsBoolean()
  @IsOptional()
  isAiGenerated?: boolean;
}
