import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Meeting } from './meeting.entity';

@Entity('speaker_mappings')
export class SpeakerMapping {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Meeting, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'meetingId' })
  meeting: Meeting;

  @Column()
  meetingId: string;

  @Column()
  speakerTag: number;

  @Column()
  speakerName: string;

  @CreateDateColumn()
  enrolledAt: Date;
}
