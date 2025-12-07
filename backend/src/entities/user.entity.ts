import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Meeting } from './meeting.entity';
import { Task } from './task.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  displayName: string;

  @Column({ nullable: true })
  photoURL: string;

  @Column({ unique: true })
  firebaseUid: string;

  // User Settings
  @Column({ default: true })
  enableTranscription: boolean;

  @Column({ default: true })
  autoSaveRecordings: boolean;

  @Column({ default: true })
  notificationsEnabled: boolean;

  @Column({ default: 'dark' })
  theme: string;

  @Column({ default: 'high' })
  audioQuality: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Meeting, meeting => meeting.creator)
  createdMeetings: Meeting[];

  @OneToMany(() => Task, task => task.assignee)
  assignedTasks: Task[];
}
