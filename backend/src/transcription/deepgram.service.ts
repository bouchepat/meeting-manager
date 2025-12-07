import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter } from 'events';
import { createClient, LiveTranscriptionEvents, LiveClient } from '@deepgram/sdk';

export interface DeepgramTranscriptResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  speakerTag: number;
  startTime: number;
  endTime: number;
  words: Array<{
    word: string;
    speakerTag: number;
    startTime: number;
    endTime: number;
    confidence: number;
  }>;
}

export interface DeepgramStreamSession {
  id: string;
  meetingId: string;
  connection: LiveClient | null;
  emitter: EventEmitter;
  isActive: boolean;
}

@Injectable()
export class DeepgramService implements OnModuleInit {
  private readonly logger = new Logger(DeepgramService.name);
  private deepgramClient: ReturnType<typeof createClient> | null = null;
  private sessions: Map<string, DeepgramStreamSession> = new Map();
  private isConfigured = false;
  private apiKey: string | null = null;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    this.apiKey = this.configService.get<string>('DEEPGRAM_API_KEY') || null;

    if (this.apiKey) {
      try {
        this.deepgramClient = createClient(this.apiKey);
        this.isConfigured = true;
        this.logger.log('Deepgram client initialized successfully');
      } catch (error) {
        this.logger.error('Failed to initialize Deepgram client:', error);
        this.isConfigured = false;
      }
    } else {
      this.logger.warn(
        'DEEPGRAM_API_KEY not configured. ' +
        'Real-time transcription with Deepgram will not be available.'
      );
      this.isConfigured = false;
    }
  }

  isAvailable(): boolean {
    return this.isConfigured && this.deepgramClient !== null;
  }

  createStreamSession(sessionId: string, meetingId: string): DeepgramStreamSession | null {
    if (!this.isAvailable()) {
      this.logger.warn('Deepgram is not configured. Cannot create stream session.');
      return null;
    }

    const emitter = new EventEmitter();
    const session: DeepgramStreamSession = {
      id: sessionId,
      meetingId,
      connection: null,
      emitter,
      isActive: false,
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  async startStreaming(sessionId: string): Promise<EventEmitter | null> {
    const session = this.sessions.get(sessionId);
    if (!session || !this.deepgramClient) {
      return null;
    }

    try {
      // Create live transcription connection with diarization enabled
      const connection = this.deepgramClient.listen.live({
        model: 'nova-2',
        language: 'en-US',
        smart_format: true,
        punctuate: true,
        diarize: true, // Enable speaker diarization!
        interim_results: true,
        utterance_end_ms: 1000,
        vad_events: true,
        encoding: 'linear16',
        sample_rate: 16000,
        channels: 1,
      });

      // Handle connection open
      connection.on(LiveTranscriptionEvents.Open, () => {
        this.logger.log(`Deepgram connection opened for session ${sessionId}`);
        session.isActive = true;
        session.emitter.emit('connected');
      });

      // Handle transcription results
      connection.on(LiveTranscriptionEvents.Transcript, (data: any) => {
        this.handleTranscript(session, data);
      });

      // Handle errors
      connection.on(LiveTranscriptionEvents.Error, (error: any) => {
        this.logger.error(`Deepgram error for session ${sessionId}:`, error);
        session.emitter.emit('error', error);
      });

      // Handle connection close
      connection.on(LiveTranscriptionEvents.Close, () => {
        this.logger.log(`Deepgram connection closed for session ${sessionId}`);
        session.isActive = false;
        session.emitter.emit('closed');
      });

      // Handle utterance end (silence detection)
      connection.on(LiveTranscriptionEvents.UtteranceEnd, () => {
        session.emitter.emit('utteranceEnd');
      });

      session.connection = connection;
      return session.emitter;

    } catch (error: any) {
      this.logger.error(`Failed to start Deepgram streaming for session ${sessionId}:`, error.message);
      return null;
    }
  }

  private handleTranscript(session: DeepgramStreamSession, data: any): void {
    const channel = data.channel;
    if (!channel?.alternatives?.length) {
      return;
    }

    const alternative = channel.alternatives[0];
    const transcript = alternative.transcript;

    if (!transcript || transcript.trim() === '') {
      return;
    }

    const isFinal = data.is_final || false;
    const words: DeepgramTranscriptResult['words'] = [];

    // Process words with speaker tags
    let startTime = 0;
    let endTime = 0;
    const speakerTagCounts: Map<number, number> = new Map();

    if (alternative.words && alternative.words.length > 0) {
      for (const wordInfo of alternative.words) {
        const speakerTag = (wordInfo.speaker ?? 0) + 1; // Deepgram uses 0-indexed, we use 1-indexed

        words.push({
          word: wordInfo.word || wordInfo.punctuated_word || '',
          speakerTag,
          startTime: wordInfo.start || 0,
          endTime: wordInfo.end || 0,
          confidence: wordInfo.confidence || 0,
        });

        // Count speaker tags
        speakerTagCounts.set(speakerTag, (speakerTagCounts.get(speakerTag) || 0) + 1);

        // Track timing
        if (startTime === 0) startTime = wordInfo.start || 0;
        endTime = wordInfo.end || 0;
      }
    }

    // Determine dominant speaker for this segment
    let speakerTag = 1;
    let maxCount = 0;
    for (const [tag, count] of speakerTagCounts) {
      if (count > maxCount) {
        maxCount = count;
        speakerTag = tag;
      }
    }

    const result: DeepgramTranscriptResult = {
      transcript: transcript.trim(),
      confidence: alternative.confidence || 0,
      isFinal,
      speakerTag,
      startTime,
      endTime,
      words,
    };

    session.emitter.emit('transcript', result);

    if (isFinal) {
      const tagDistribution = Object.fromEntries(speakerTagCounts);
      this.logger.log(
        `Final transcript for session ${session.id}: "${result.transcript}" ` +
        `(Speaker ${speakerTag}, distribution: ${JSON.stringify(tagDistribution)})`
      );
    }
  }

  writeAudio(sessionId: string, audioData: Buffer): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !session.connection || !session.isActive) {
      return false;
    }

    try {
      // Convert Buffer to ArrayBuffer for Deepgram SDK
      const arrayBuffer = audioData.buffer.slice(
        audioData.byteOffset,
        audioData.byteOffset + audioData.byteLength,
      );
      session.connection.send(arrayBuffer);
      return true;
    } catch (error: any) {
      this.logger.error(`Error sending audio for session ${sessionId}:`, error.message);
      return false;
    }
  }

  stopStreaming(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    this.logger.log(`Stopping Deepgram stream for session ${sessionId}`);

    if (session.connection) {
      try {
        session.connection.finish();
      } catch (e) {
        // Ignore errors when closing
      }
    }

    session.isActive = false;
    session.emitter.emit('stopped');
  }

  destroySession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.stopStreaming(sessionId);
      session.emitter.removeAllListeners();
      this.sessions.delete(sessionId);
      this.logger.log(`Destroyed Deepgram session ${sessionId}`);
    }
  }

  getSession(sessionId: string): DeepgramStreamSession | undefined {
    return this.sessions.get(sessionId);
  }
}
