import { IsOptional, IsString, IsUUID, IsEnum, IsDateString } from 'class-validator';
import { TaskStatus, TaskPriority } from '../../entities/task.entity';

export class UpdateTaskDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  @IsDateString()
  @IsOptional()
  dueDate?: Date;

  @IsUUID()
  @IsOptional()
  assigneeId?: string;
}
