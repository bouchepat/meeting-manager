import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { Guest } from './guest.entity';
import { Task } from './task.entity';
import { MeetingSummary } from './meeting-summary.entity';
import { TranscriptSegment } from './transcript-segment.entity';

export enum MeetingStatus {
  RECORDING = 'recording',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

@Entity('meetings')
export class Meeting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: MeetingStatus,
    default: MeetingStatus.RECORDING
  })
  status: MeetingStatus;

  @Column({ nullable: true })
  recordingUrl: string;

  @Column({ nullable: true })
  transcriptUrl: string;

  @Column({ nullable: true })
  recordingDuration: number; // in seconds

  @Column({ type: 'bigint', nullable: true })
  recordingFileSize: number; // in bytes

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  endedAt: Date;

  @ManyToOne(() => User, user => user.createdMeetings, { eager: true })
  @JoinColumn({ name: 'creatorId' })
  creator: User;

  @Column()
  creatorId: string;

  @OneToMany(() => Guest, guest => guest.meeting, { cascade: true })
  guests: Guest[];

  @OneToMany(() => Task, task => task.meeting, { cascade: true })
  tasks: Task[];

  @OneToMany(() => MeetingSummary, summary => summary.meeting, { cascade: true })
  summaries: MeetingSummary[];

  @OneToMany(() => TranscriptSegment, segment => segment.meeting, { cascade: true })
  transcriptSegments: TranscriptSegment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
