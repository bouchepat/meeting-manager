import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { GoogleSpeechService, TranscriptResult } from './google-speech.service';
import { DeepgramService, DeepgramTranscriptResult } from './deepgram.service';
import { TranscriptionService, TranscriptSegmentDto } from './transcription.service';
import { SpeakerEnrollmentService } from './speaker-enrollment.service';

type SessionMode = 'enrollment' | 'transcription';
type TranscriptionProvider = 'deepgram' | 'google';

interface ClientSession {
  socketId: string;
  meetingId: string;
  speechSessionId: string;
  userId?: string;
  isStreaming: boolean;
  mode: SessionMode;
  speakerMappings: Map<number, string>;
  provider: TranscriptionProvider;
}

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:4200', 'http://localhost:3000'],
    credentials: true,
  },
  namespace: '/transcription',
})
export class TranscriptionGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TranscriptionGateway.name);
  private clientSessions: Map<string, ClientSession> = new Map();

  constructor(
    private readonly googleSpeechService: GoogleSpeechService,
    private readonly deepgramService: DeepgramService,
    private readonly transcriptionService: TranscriptionService,
    private readonly speakerEnrollmentService: SpeakerEnrollmentService,
  ) {}

  /**
   * Get the best available transcription provider
   * Prefers Deepgram (better real-time diarization), falls back to Google Speech
   */
  private getPreferredProvider(): TranscriptionProvider | null {
    if (this.deepgramService.isAvailable()) {
      return 'deepgram';
    }
    if (this.googleSpeechService.isAvailable()) {
      return 'google';
    }
    return null;
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);

    const provider = this.getPreferredProvider();

    // Send initial status
    client.emit('status', {
      connected: true,
      speechServiceAvailable: provider !== null,
      provider: provider,
      deepgramAvailable: this.deepgramService.isAvailable(),
      googleSpeechAvailable: this.googleSpeechService.isAvailable(),
    });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.cleanupClientSession(client.id);
  }

  @SubscribeMessage('startEnrollment')
  async handleStartEnrollment(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { meetingId: string; userId?: string },
  ) {
    await this.startSession(client, data, 'enrollment');
  }

  @SubscribeMessage('startTranscription')
  async handleStartTranscription(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { meetingId: string; userId?: string },
  ) {
    await this.startSession(client, data, 'transcription');
  }

  private async startSession(
    client: Socket,
    data: { meetingId: string; userId?: string },
    mode: SessionMode,
  ) {
    const { meetingId, userId } = data;

    if (!meetingId) {
      client.emit('error', { message: 'Meeting ID is required' });
      return;
    }

    const provider = this.getPreferredProvider();
    if (!provider) {
      client.emit('error', {
        message: 'Speech-to-text service is not available. Please configure Deepgram or Google Cloud credentials.',
      });
      return;
    }

    // Create speech session based on provider
    const speechSessionId = uuidv4();
    let sessionCreated = false;

    if (provider === 'deepgram') {
      const session = this.deepgramService.createStreamSession(speechSessionId, meetingId);
      sessionCreated = session !== null;
    } else {
      const session = this.googleSpeechService.createStreamSession(speechSessionId, meetingId);
      sessionCreated = session !== null;
    }

    if (!sessionCreated) {
      client.emit('error', { message: 'Failed to create speech session' });
      return;
    }

    // Load existing speaker mappings
    const speakerMappings = await this.speakerEnrollmentService.getSpeakerMappings(meetingId);
    this.logger.log(`Loaded ${speakerMappings.size} speaker mappings for meeting ${meetingId}: ${JSON.stringify(Object.fromEntries(speakerMappings))}`);

    // Store client session
    const clientSession: ClientSession = {
      socketId: client.id,
      meetingId,
      speechSessionId,
      userId,
      isStreaming: false,
      mode,
      speakerMappings,
      provider,
    };
    this.clientSessions.set(client.id, clientSession);

    // Join meeting room for potential multi-client support
    client.join(`meeting:${meetingId}`);

    // Start streaming and set up event handlers based on provider
    if (provider === 'deepgram') {
      const emitter = await this.deepgramService.startStreaming(speechSessionId);

      if (emitter) {
        clientSession.isStreaming = true;

        emitter.on('transcript', async (result: DeepgramTranscriptResult) => {
          // Convert Deepgram result to common format
          const transcriptResult: TranscriptResult = {
            transcript: result.transcript,
            confidence: result.confidence,
            isFinal: result.isFinal,
            speakerTag: result.speakerTag,
            startTime: result.startTime,
            endTime: result.endTime,
            words: result.words,
          };
          await this.handleTranscriptResult(client, clientSession, transcriptResult);
        });

        emitter.on('error', (error: Error) => {
          this.logger.error(`Deepgram error for client ${client.id}:`, error.message);
          client.emit('error', { message: 'Transcription error: ' + error.message });
        });

        emitter.on('closed', () => {
          clientSession.isStreaming = false;
        });
      }
    } else {
      // Google Speech
      const emitter = this.googleSpeechService.startStreaming(speechSessionId);

      if (emitter) {
        clientSession.isStreaming = true;

        emitter.on('transcript', async (result: TranscriptResult) => {
          await this.handleTranscriptResult(client, clientSession, result);
        });

        emitter.on('error', (error: Error) => {
          this.logger.error(`Speech error for client ${client.id}:`, error.message);
          client.emit('error', { message: 'Transcription error: ' + error.message });
        });

        emitter.on('restarted', () => {
          this.logger.log(`Stream restarted for client ${client.id}`);
          client.emit('streamRestarted');
        });

        emitter.on('stopped', () => {
          clientSession.isStreaming = false;
        });
      }
    }

    this.logger.log(`Started ${mode} for meeting ${meetingId}, session ${speechSessionId} using ${provider}`);

    const eventName = mode === 'enrollment' ? 'enrollmentStarted' : 'transcriptionStarted';
    client.emit(eventName, {
      sessionId: speechSessionId,
      speakerMappings: Object.fromEntries(clientSession.speakerMappings),
      provider,
    });
  }

  private async handleTranscriptResult(
    client: Socket,
    session: ClientSession,
    result: TranscriptResult,
  ) {
    const { meetingId, mode, speakerMappings } = session;

    // Get speaker name if enrolled
    let speakerName = speakerMappings.get(result.speakerTag) || null;

    // In enrollment mode, try to detect name from transcript
    if (mode === 'enrollment' && result.isFinal && !speakerName) {
      const extractionResult = this.speakerEnrollmentService.extractNameFromTranscript(result.transcript);

      if (extractionResult && this.speakerEnrollmentService.validateName(extractionResult.name)) {
        // Save the mapping
        await this.speakerEnrollmentService.saveSpeakerMapping(
          meetingId,
          result.speakerTag,
          extractionResult.name,
        );

        // Update local cache
        speakerMappings.set(result.speakerTag, extractionResult.name);
        speakerName = extractionResult.name;

        // Notify client of new enrollment with extraction details
        client.emit('speakerEnrolled', {
          speakerTag: result.speakerTag,
          speakerName: extractionResult.name,
          confidence: extractionResult.confidence,
          method: extractionResult.method,
        });

        this.logger.log(
          `Enrolled speaker ${result.speakerTag} as "${extractionResult.name}" ` +
          `(${extractionResult.method}, ${extractionResult.confidence}) for meeting ${meetingId}`
        );
      }
    }

    // Send transcript to client
    client.emit('transcript', {
      transcript: result.transcript,
      speakerTag: result.speakerTag,
      speakerName,
      isFinal: result.isFinal,
      confidence: result.confidence,
      startTime: result.startTime,
      endTime: result.endTime,
      words: result.words,
    });

    // Broadcast to all clients in the meeting room (for observers)
    this.server.to(`meeting:${meetingId}`).emit('transcriptUpdate', {
      transcript: result.transcript,
      speakerTag: result.speakerTag,
      speakerName,
      isFinal: result.isFinal,
    });

    // Save final segments to database (only in transcription mode)
    if (mode === 'transcription' && result.isFinal && result.transcript.trim()) {
      try {
        const segmentDto: TranscriptSegmentDto = {
          speakerTag: result.speakerTag,
          speakerName: speakerName ?? undefined,
          transcript: result.transcript,
          confidence: result.confidence,
          startTime: result.startTime,
          endTime: result.endTime,
          isFinal: true,
        };
        await this.transcriptionService.saveSegment(meetingId, segmentDto);
      } catch (error) {
        this.logger.error('Failed to save transcript segment:', error);
      }
    }
  }

  @SubscribeMessage('stopEnrollment')
  async handleStopEnrollment(@ConnectedSocket() client: Socket) {
    const session = this.clientSessions.get(client.id);

    if (!session) {
      return;
    }

    this.logger.log(`Stopping enrollment for meeting ${session.meetingId}`);

    // Stop the speech stream based on provider
    if (session.provider === 'deepgram') {
      this.deepgramService.stopStreaming(session.speechSessionId);
      this.deepgramService.destroySession(session.speechSessionId);
    } else {
      this.googleSpeechService.stopStreaming(session.speechSessionId);
      this.googleSpeechService.destroySession(session.speechSessionId);
    }

    // Return the enrolled speakers
    const speakerMappings = await this.speakerEnrollmentService.getSpeakerMappings(session.meetingId);

    client.emit('enrollmentStopped', {
      meetingId: session.meetingId,
      speakerMappings: Object.fromEntries(speakerMappings),
    });

    this.clientSessions.delete(client.id);
  }

  @SubscribeMessage('getSpeakerMappings')
  async handleGetSpeakerMappings(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { meetingId: string },
  ) {
    const { meetingId } = data;
    const speakerMappings = await this.speakerEnrollmentService.getSpeakerMappings(meetingId);
    client.emit('speakerMappings', {
      meetingId,
      speakerMappings: Object.fromEntries(speakerMappings),
    });
  }

  @SubscribeMessage('enrollSpeaker')
  async handleEnrollSpeaker(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { meetingId: string; speakerTag: number; speakerName: string },
  ) {
    const { meetingId, speakerTag, speakerName } = data;

    if (!meetingId || speakerTag === undefined || !speakerName) {
      client.emit('error', { message: 'Meeting ID, speaker tag, and name are required' });
      return;
    }

    // Validate the name
    if (!this.speakerEnrollmentService.validateName(speakerName)) {
      client.emit('error', { message: 'Invalid speaker name' });
      return;
    }

    try {
      // Save the mapping
      await this.speakerEnrollmentService.saveSpeakerMapping(meetingId, speakerTag, speakerName);

      // Update session cache if active
      const session = this.clientSessions.get(client.id);
      if (session && session.meetingId === meetingId) {
        session.speakerMappings.set(speakerTag, speakerName);
      }

      // Notify client
      client.emit('speakerEnrolled', {
        speakerTag,
        speakerName,
        confidence: 'high',
        method: 'manual',
      });

      // Broadcast to all clients in the meeting room
      this.server.to(`meeting:${meetingId}`).emit('speakerMappingUpdated', {
        meetingId,
        speakerTag,
        speakerName,
      });

      this.logger.log(`Manually enrolled speaker ${speakerTag} as "${speakerName}" for meeting ${meetingId}`);
    } catch (error) {
      this.logger.error('Failed to enroll speaker:', error);
      client.emit('error', { message: 'Failed to enroll speaker' });
    }
  }

  @SubscribeMessage('removeSpeakerMapping')
  async handleRemoveSpeakerMapping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { meetingId: string; speakerTag: number },
  ) {
    const { meetingId, speakerTag } = data;

    if (!meetingId || speakerTag === undefined) {
      client.emit('error', { message: 'Meeting ID and speaker tag are required' });
      return;
    }

    try {
      // Remove from database (we need to add this method to the service)
      await this.speakerEnrollmentService.removeSpeakerMapping(meetingId, speakerTag);

      // Update session cache if active
      const session = this.clientSessions.get(client.id);
      if (session && session.meetingId === meetingId) {
        session.speakerMappings.delete(speakerTag);
      }

      // Notify client
      client.emit('speakerMappingRemoved', { meetingId, speakerTag });

      // Broadcast to all clients in the meeting room
      this.server.to(`meeting:${meetingId}`).emit('speakerMappingRemoved', {
        meetingId,
        speakerTag,
      });

      this.logger.log(`Removed speaker mapping for tag ${speakerTag} in meeting ${meetingId}`);
    } catch (error) {
      this.logger.error('Failed to remove speaker mapping:', error);
      client.emit('error', { message: 'Failed to remove speaker mapping' });
    }
  }

  @SubscribeMessage('audioData')
  handleAudioData(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ArrayBuffer | Buffer,
  ) {
    const session = this.clientSessions.get(client.id);

    if (!session || !session.isStreaming) {
      return;
    }

    // Convert to Buffer if needed
    const audioBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data);

    // Write to the appropriate speech provider
    let success = false;
    if (session.provider === 'deepgram') {
      success = this.deepgramService.writeAudio(session.speechSessionId, audioBuffer);
    } else {
      success = this.googleSpeechService.writeAudio(session.speechSessionId, audioBuffer);
    }

    if (!success) {
      this.logger.warn(`Failed to write audio for client ${client.id} (provider: ${session.provider})`);
    }
  }

  @SubscribeMessage('stopTranscription')
  async handleStopTranscription(@ConnectedSocket() client: Socket) {
    const session = this.clientSessions.get(client.id);

    if (!session) {
      return;
    }

    this.logger.log(`Stopping transcription for meeting ${session.meetingId} (provider: ${session.provider})`);

    // Stop the speech stream based on provider
    if (session.provider === 'deepgram') {
      this.deepgramService.stopStreaming(session.speechSessionId);
      this.deepgramService.destroySession(session.speechSessionId);
    } else {
      this.googleSpeechService.stopStreaming(session.speechSessionId);
      this.googleSpeechService.destroySession(session.speechSessionId);
    }

    // Clean up interim segments and generate final transcript
    try {
      await this.transcriptionService.deleteInterimSegments(session.meetingId);
      const fullTranscript = await this.transcriptionService.generateFullTranscript(session.meetingId);

      client.emit('transcriptionStopped', {
        meetingId: session.meetingId,
        fullTranscript,
      });
    } catch (error) {
      this.logger.error('Error finalizing transcription:', error);
      client.emit('transcriptionStopped', { meetingId: session.meetingId });
    }

    // Leave room and cleanup
    client.leave(`meeting:${session.meetingId}`);
    this.cleanupClientSession(client.id);
  }

  @SubscribeMessage('getTranscript')
  async handleGetTranscript(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { meetingId: string },
  ) {
    const { meetingId } = data;

    try {
      const segments = await this.transcriptionService.getFinalSegmentsByMeeting(meetingId);
      client.emit('transcriptHistory', { meetingId, segments });
    } catch (error) {
      this.logger.error('Error fetching transcript:', error);
      client.emit('error', { message: 'Failed to fetch transcript' });
    }
  }

  private cleanupClientSession(socketId: string) {
    const session = this.clientSessions.get(socketId);

    if (session) {
      // Cleanup based on provider
      if (session.provider === 'deepgram') {
        this.deepgramService.destroySession(session.speechSessionId);
      } else {
        this.googleSpeechService.destroySession(session.speechSessionId);
      }
      this.clientSessions.delete(socketId);
      this.logger.log(`Cleaned up session for client ${socketId} (provider: ${session.provider})`);
    }
  }
}
