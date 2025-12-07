import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Meeting } from './meeting.entity';

@Entity('meeting_summaries')
export class MeetingSummary {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  summary: string;

  @Column({ type: 'json', nullable: true })
  keyPoints: string[]; // Array of key discussion points

  @Column({ type: 'json', nullable: true })
  decisions: string[]; // Array of decisions made

  @Column({ type: 'json', nullable: true })
  actionItems: string[]; // Array of action items

  @Column({ default: true })
  isAiGenerated: boolean;

  @ManyToOne(() => Meeting, meeting => meeting.summaries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'meetingId' })
  meeting: Meeting;

  @Column()
  meetingId: string;

  @CreateDateColumn()
  createdAt: Date;
}
