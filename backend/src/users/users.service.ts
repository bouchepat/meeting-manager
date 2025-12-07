import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Meeting } from '../entities/meeting.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

export interface UserStats {
  totalRecordings: number;
  totalDurationSeconds: number;
  memberSince: Date;
}

export interface StorageStats {
  usedBytes: number;
  recordingCount: number;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Meeting)
    private meetingsRepository: Repository<Meeting>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const user = this.usersRepository.create(createUserDto);
    return await this.usersRepository.save(user);
  }

  async findAll(): Promise<User[]> {
    return await this.usersRepository.find();
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async findByFirebaseUid(firebaseUid: string): Promise<User | null> {
    return await this.usersRepository.findOne({ where: { firebaseUid } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.usersRepository.findOne({ where: { email } });
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    await this.usersRepository.update(id, updateUserDto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const result = await this.usersRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }

  async getUserStats(userId: string): Promise<UserStats> {
    const user = await this.findOne(userId);

    // Get total recordings count and sum of durations
    const stats = await this.meetingsRepository
      .createQueryBuilder('meeting')
      .select('COUNT(*)', 'totalRecordings')
      .addSelect('COALESCE(SUM(meeting.recordingDuration), 0)', 'totalDurationSeconds')
      .where('meeting.creatorId = :userId', { userId })
      .getRawOne();

    return {
      totalRecordings: parseInt(stats.totalRecordings, 10) || 0,
      totalDurationSeconds: parseInt(stats.totalDurationSeconds, 10) || 0,
      memberSince: user.createdAt,
    };
  }

  async getStorageStats(userId: string): Promise<StorageStats> {
    // Get total storage used by user's recordings
    const stats = await this.meetingsRepository
      .createQueryBuilder('meeting')
      .select('COALESCE(SUM(meeting.recordingFileSize), 0)', 'usedBytes')
      .addSelect('COUNT(CASE WHEN meeting.recordingFileSize IS NOT NULL THEN 1 END)', 'recordingCount')
      .where('meeting.creatorId = :userId', { userId })
      .getRawOne();

    return {
      usedBytes: parseInt(stats.usedBytes, 10) || 0,
      recordingCount: parseInt(stats.recordingCount, 10) || 0,
    };
  }
}
