import { Injectable, signal, computed } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';

export interface TranscriptSegment {
  id?: string;
  transcript: string;
  speakerTag: number;
  speakerName?: string;
  isFinal: boolean;
  confidence?: number;
  startTime: number;
  endTime: number;
  words?: Array<{
    word: string;
    speakerTag: number;
    startTime: number;
    endTime: number;
  }>;
}

export interface TranscriptionStatus {
  connected: boolean;
  speechServiceAvailable: boolean;
  isTranscribing: boolean;
  isEnrolling: boolean;
  error?: string;
}

export interface SpeakerMappings {
  [speakerTag: number]: string;
}

@Injectable({
  providedIn: 'root'
})
export class TranscriptionService {
  private socket: Socket | null = null;
  private audioContext: AudioContext | null = null;
  private audioWorkletNode: AudioWorkletNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;

  // Reactive state
  private _status = signal<TranscriptionStatus>({
    connected: false,
    speechServiceAvailable: false,
    isTranscribing: false,
    isEnrolling: false,
  });

  private _segments = signal<TranscriptSegment[]>([]);
  private _currentInterim = signal<TranscriptSegment | null>(null);
  private _speakerMappings = signal<SpeakerMappings>({});
  private _enrollmentSegments = signal<TranscriptSegment[]>([]);

  // Public computed signals
  status = computed(() => this._status());
  segments = computed(() => this._segments());
  currentInterim = computed(() => this._currentInterim());
  speakerMappings = computed(() => this._speakerMappings());
  enrollmentSegments = computed(() => this._enrollmentSegments());

  enrolledSpeakerCount = computed(() => Object.keys(this._speakerMappings()).length);

  // Combine final segments with current interim for display
  displaySegments = computed(() => {
    const finals = this._segments();
    const interim = this._currentInterim();
    return interim ? [...finals, interim] : finals;
  });

  fullTranscript = computed(() => {
    const segments = this._segments();
    let transcript = '';
    let currentSpeaker = -1;

    for (const segment of segments) {
      if (segment.speakerTag !== currentSpeaker) {
        currentSpeaker = segment.speakerTag;
        const speakerLabel = segment.speakerName || `Speaker ${segment.speakerTag}`;
        transcript += `\n\n[${speakerLabel}]:\n`;
      }
      transcript += segment.transcript + ' ';
    }

    return transcript.trim();
  });

  connect(): void {
    if (this.socket?.connected) {
      return;
    }

    const wsUrl = environment.apiUrl.replace('/api', '');
    this.socket = io(`${wsUrl}/transcription`, {
      transports: ['websocket'],
      autoConnect: true,
    });

    this.setupSocketListeners();
  }

  private setupSocketListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Transcription socket connected');
    });

    this.socket.on('disconnect', () => {
      console.log('Transcription socket disconnected');
      this._status.update(s => ({ ...s, connected: false, isTranscribing: false }));
    });

    this.socket.on('status', (data: { connected: boolean; speechServiceAvailable: boolean }) => {
      this._status.update(s => ({
        ...s,
        connected: data.connected,
        speechServiceAvailable: data.speechServiceAvailable,
      }));
    });

    this.socket.on('transcriptionStarted', (data: { sessionId: string; speakerMappings: SpeakerMappings }) => {
      console.log('Transcription started:', data.sessionId);
      this._speakerMappings.set(data.speakerMappings || {});
      this._status.update(s => ({ ...s, isTranscribing: true, error: undefined }));
    });

    this.socket.on('enrollmentStarted', (data: { sessionId: string; speakerMappings: SpeakerMappings }) => {
      console.log('Enrollment started:', data.sessionId);
      this._speakerMappings.set(data.speakerMappings || {});
      this._status.update(s => ({ ...s, isEnrolling: true, error: undefined }));
    });

    this.socket.on('transcript', (data: TranscriptSegment) => {
      const status = this._status();

      if (status.isEnrolling) {
        // In enrollment mode, just show the transcript for feedback
        if (data.isFinal) {
          this._enrollmentSegments.update(segments => [...segments, data]);
          this._currentInterim.set(null);
        } else {
          this._currentInterim.set(data);
        }
      } else {
        // Normal transcription mode - merge consecutive segments from same speaker
        if (data.isFinal) {
          this._segments.update(segments => {
            if (segments.length === 0) {
              return [data];
            }

            const lastSegment = segments[segments.length - 1];

            // If same speaker, merge the transcript text
            if (lastSegment.speakerTag === data.speakerTag) {
              const merged: TranscriptSegment = {
                ...lastSegment,
                transcript: lastSegment.transcript + ' ' + data.transcript,
                endTime: data.endTime,
                confidence: data.confidence, // Use latest confidence
              };
              return [...segments.slice(0, -1), merged];
            }

            // Different speaker, add as new segment
            return [...segments, data];
          });
          this._currentInterim.set(null);
        } else {
          this._currentInterim.set(data);
        }
      }
    });

    this.socket.on('speakerEnrolled', (data: { speakerTag: number; speakerName: string; confidence?: string; method?: string }) => {
      console.log(`Speaker ${data.speakerTag} enrolled as "${data.speakerName}" (${data.method || 'unknown'}, ${data.confidence || 'unknown'})`);
      this._speakerMappings.update(mappings => ({
        ...mappings,
        [data.speakerTag]: data.speakerName,
      }));
    });

    this.socket.on('speakerMappingUpdated', (data: { meetingId: string; speakerTag: number; speakerName: string }) => {
      console.log(`Speaker mapping updated: ${data.speakerTag} -> "${data.speakerName}"`);
      this._speakerMappings.update(mappings => ({
        ...mappings,
        [data.speakerTag]: data.speakerName,
      }));
    });

    this.socket.on('speakerMappingRemoved', (data: { meetingId: string; speakerTag: number }) => {
      console.log(`Speaker mapping removed: ${data.speakerTag}`);
      this._speakerMappings.update(mappings => {
        const updated = { ...mappings };
        delete updated[data.speakerTag];
        return updated;
      });
    });

    this.socket.on('enrollmentStopped', (data: { meetingId: string; speakerMappings: SpeakerMappings }) => {
      console.log('Enrollment stopped for meeting:', data.meetingId);
      this._speakerMappings.set(data.speakerMappings || {});
      this._status.update(s => ({ ...s, isEnrolling: false }));
      this._currentInterim.set(null);
      this.stopAudioProcessing();
    });

    this.socket.on('transcriptionStopped', (data: { meetingId: string; fullTranscript?: string }) => {
      console.log('Transcription stopped for meeting:', data.meetingId);
      this._status.update(s => ({ ...s, isTranscribing: false }));
      this._currentInterim.set(null);
    });

    this.socket.on('streamRestarted', () => {
      console.log('Stream restarted (due to Google limit)');
    });

    this.socket.on('error', (data: { message: string }) => {
      console.error('Transcription error:', data.message);
      this._status.update(s => ({ ...s, error: data.message }));
    });

    this.socket.on('transcriptHistory', (data: { meetingId: string; segments: TranscriptSegment[] }) => {
      this._segments.set(data.segments);
    });

    this.socket.on('speakerMappings', (data: { meetingId: string; speakerMappings: SpeakerMappings }) => {
      this._speakerMappings.set(data.speakerMappings || {});
    });
  }

  private async ensureConnected(): Promise<void> {
    if (!this.socket?.connected) {
      this.connect();
      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);
        this.socket?.once('status', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
  }

  async startEnrollment(meetingId: string, stream: MediaStream, userId?: string): Promise<void> {
    await this.ensureConnected();

    // Clear previous enrollment data
    this._enrollmentSegments.set([]);
    this._currentInterim.set(null);

    // Start enrollment on server
    this.socket!.emit('startEnrollment', { meetingId, userId });

    // Set up audio processing
    await this.setupAudioProcessing(stream);
  }

  stopEnrollment(): void {
    this.socket?.emit('stopEnrollment');
  }

  async startTranscription(meetingId: string, stream: MediaStream, userId?: string): Promise<void> {
    await this.ensureConnected();

    // Clear previous segments
    this._segments.set([]);
    this._currentInterim.set(null);

    // Start transcription on server
    this.socket!.emit('startTranscription', { meetingId, userId });

    // Set up audio processing
    await this.setupAudioProcessing(stream);
  }

  private async setupAudioProcessing(stream: MediaStream): Promise<void> {
    // Create AudioContext with 16kHz sample rate for Google Speech
    this.audioContext = new AudioContext({ sampleRate: 16000 });

    // Create source from stream
    this.sourceNode = this.audioContext.createMediaStreamSource(stream);

    // Use ScriptProcessorNode for audio processing (simpler than AudioWorklet)
    // Note: ScriptProcessorNode is deprecated but still widely supported
    const bufferSize = 4096;
    const processorNode = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

    processorNode.onaudioprocess = (event) => {
      const status = this._status();
      if ((!status.isTranscribing && !status.isEnrolling) || !this.socket?.connected) {
        return;
      }

      const inputData = event.inputBuffer.getChannelData(0);

      // Convert Float32 to Int16 (LINEAR16 format for Google Speech)
      const int16Data = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }

      // Send to server
      this.socket!.emit('audioData', int16Data.buffer);
    };

    // Connect nodes
    this.sourceNode.connect(processorNode);
    processorNode.connect(this.audioContext.destination);
  }

  private stopAudioProcessing(): void {
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  stopTranscription(): void {
    this.stopAudioProcessing();
    // Tell server to stop
    this.socket?.emit('stopTranscription');
  }

  getTranscriptHistory(meetingId: string): void {
    this.socket?.emit('getTranscript', { meetingId });
  }

  disconnect(): void {
    this.stopTranscription();
    this.socket?.disconnect();
    this.socket = null;
    this._status.set({
      connected: false,
      speechServiceAvailable: false,
      isTranscribing: false,
      isEnrolling: false,
    });
  }

  clearSegments(): void {
    this._segments.set([]);
    this._currentInterim.set(null);
    this._enrollmentSegments.set([]);
    this._speakerMappings.set({});
  }

  clearSpeakerMappings(): void {
    this._speakerMappings.set({});
    this._enrollmentSegments.set([]);
  }

  getSpeakerName(speakerTag: number): string {
    const mappings = this._speakerMappings();
    return mappings[speakerTag] || `Speaker ${speakerTag}`;
  }

  /**
   * Manually enroll a speaker with a given name
   */
  enrollSpeaker(meetingId: string, speakerTag: number, speakerName: string): void {
    if (!this.socket?.connected) {
      console.error('Socket not connected');
      return;
    }
    this.socket.emit('enrollSpeaker', { meetingId, speakerTag, speakerName });
  }

  /**
   * Remove a speaker mapping
   */
  removeSpeakerMapping(meetingId: string, speakerTag: number): void {
    if (!this.socket?.connected) {
      console.error('Socket not connected');
      return;
    }
    this.socket.emit('removeSpeakerMapping', { meetingId, speakerTag });
  }

  /**
   * Get speaker mappings for a meeting
   */
  getSpeakerMappings(meetingId: string): void {
    if (!this.socket?.connected) {
      console.error('Socket not connected');
      return;
    }
    this.socket.emit('getSpeakerMappings', { meetingId });
  }
}
