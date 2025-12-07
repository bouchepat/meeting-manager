import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Meeting } from './meeting.entity';

@Entity('guests')
export class Guest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  role: string; // Role in the meeting (e.g., "Presenter", "Participant")

  @Column({ default: false })
  isAiDetected: boolean; // Whether this guest was detected by AI

  @ManyToOne(() => Meeting, meeting => meeting.guests, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'meetingId' })
  meeting: Meeting;

  @Column()
  meetingId: string;

  @CreateDateColumn()
  createdAt: Date;
}
