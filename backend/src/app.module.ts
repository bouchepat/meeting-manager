import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { APP_GUARD } from '@nestjs/core';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { User, Meeting, Guest, Task, MeetingSummary, TranscriptSegment, SpeakerMapping } from './entities';
import { UsersModule } from './users/users.module';
import { MeetingsModule } from './meetings/meetings.module';
import { TasksModule } from './tasks/tasks.module';
import { AuthModule } from './auth/auth.module';
import { UploadsModule } from './uploads/uploads.module';
import { TranscriptionModule } from './transcription/transcription.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // Serve static files from uploads directory
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
      serveStaticOptions: {
        index: false,
      },
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('DATABASE_HOST', 'localhost'),
        port: configService.get<number>('DATABASE_PORT', 3306),
        username: configService.get<string>('DATABASE_USER', 'root'),
        password: configService.get<string>('DATABASE_PASSWORD', 'root'),
        database: configService.get<string>('DATABASE_NAME', 'meeting_manager'),
        entities: [User, Meeting, Guest, Task, MeetingSummary, TranscriptSegment, SpeakerMapping],
        // synchronize: true, // Set to false in production and use migrations
        // logging: true,
      }),
    }),
    AuthModule,
    UsersModule,
    MeetingsModule,
    TasksModule,
    UploadsModule,
    TranscriptionModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule { }
