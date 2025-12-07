import { User } from './user.model';
import { Guest } from './guest.model';
import { Task } from './task.model';
import { MeetingSummary } from './meeting-summary.model';

export enum MeetingStatus {
  RECORDING = 'recording',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export interface Meeting {
  id: string;
  title: string;
  description?: string;
  status: MeetingStatus;
  recordingUrl?: string;
  recordingDuration?: number;
  startedAt?: Date;
  endedAt?: Date;
  creator: User;
  creatorId: string;
  guests: Guest[];
  tasks: Task[];
  summaries: MeetingSummary[];
  createdAt: Date;
  updatedAt: Date;
}
