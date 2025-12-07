import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Meeting } from './meeting.entity';

@Entity('transcript_segments')
export class TranscriptSegment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Meeting, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'meetingId' })
  meeting: Meeting;

  @Column()
  meetingId: string;

  @Column({ default: 1 })
  speakerTag: number;

  @Column({ nullable: true })
  speakerName: string;

  @Column({ type: 'text' })
  transcript: string;

  @Column({ type: 'float', nullable: true })
  confidence: number;

  @Column({ type: 'float' })
  startTime: number;

  @Column({ type: 'float' })
  endTime: number;

  @Column({ default: false })
  isFinal: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
