import { User } from './user.model';

export enum TaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  DONE = 'done'
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: Date;
  isAiGenerated: boolean;
  meetingId: string;
  assignee?: User;
  assigneeId?: string;
  createdAt: Date;
  updatedAt: Date;
}
