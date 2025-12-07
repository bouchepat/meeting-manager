import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';

export interface WhisperSegment {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
}

export interface WhisperTranscription {
  text: string;
  segments: WhisperSegment[];
  language: string;
  duration: number;
}

@Injectable()
export class WhisperService {
  private readonly logger = new Logger(WhisperService.name);
  private openai: OpenAI | null = null;
  private isConfigured = false;

  constructor(private configService: ConfigService) {
    this.initializeClient();
  }

  private initializeClient(): void {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');

    if (apiKey) {
      try {
        this.openai = new OpenAI({ apiKey });
        this.isConfigured = true;
        this.logger.log('Whisper service initialized');
      } catch (error) {
        this.logger.error('Failed to initialize Whisper service:', error);
        this.isConfigured = false;
      }
    } else {
      this.logger.warn('OPENAI_API_KEY not configured. Whisper transcription not available.');
      this.isConfigured = false;
    }
  }

  isAvailable(): boolean {
    return this.isConfigured && this.openai !== null;
  }

  /**
   * Transcribe an audio file using OpenAI Whisper
   * Returns detailed segments with timestamps
   */
  async transcribe(audioFilePath: string): Promise<WhisperTranscription> {
    if (!this.isAvailable()) {
      throw new Error('Whisper service not available');
    }

    this.logger.log(`Transcribing file: ${path.basename(audioFilePath)}`);

    const fileStream = fs.createReadStream(audioFilePath);

    try {
      // Use verbose_json to get segment-level timestamps
      const response = await this.openai!.audio.transcriptions.create({
        file: fileStream,
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['segment'],
      });

      // Type assertion since response_format changes the return type
      const result = response as unknown as {
        text: string;
        segments: WhisperSegment[];
        language: string;
        duration: number;
      };

      this.logger.log(`Transcription complete: ${result.segments?.length || 0} segments, language: ${result.language}, duration: ${result.duration}s`);
      this.logger.log(`Full transcript (${result.text?.length || 0} chars): ${result.text?.substring(0, 200)}...`);

      return {
        text: result.text,
        segments: result.segments || [],
        language: result.language,
        duration: result.duration,
      };
    } catch (error: any) {
      this.logger.error(`Whisper transcription failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Transcribe and return just the text (simpler API)
   */
  async transcribeText(audioFilePath: string): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('Whisper service not available');
    }

    const fileStream = fs.createReadStream(audioFilePath);

    const response = await this.openai!.audio.transcriptions.create({
      file: fileStream,
      model: 'whisper-1',
      response_format: 'text',
    });

    return response as unknown as string;
  }
}
