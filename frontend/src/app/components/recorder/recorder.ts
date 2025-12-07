import { Component, OnInit, OnDestroy, inject, signal, computed, ViewChild, ElementRef, effect } from '@angular/core';
import { CommonModule, KeyValuePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MeetingService } from '../../services/meeting.service';
import { AuthService } from '../../services/auth.service';
import { UploadService } from '../../services/upload.service';
import { TranscriptionService, TranscriptSegment } from '../../services/transcription.service';

@Component({
  selector: 'app-recorder',
  imports: [CommonModule, FormsModule, KeyValuePipe],
  templateUrl: './recorder.html',
  styleUrl: './recorder.scss',
})
export class Recorder implements OnInit, OnDestroy {
  private meetingService = inject(MeetingService);
  private authService = inject(AuthService);
  private uploadService = inject(UploadService);
  transcriptionService = inject(TranscriptionService); // Public for template access
  private router = inject(Router);

  // Reference to transcript container for auto-scrolling
  @ViewChild('transcriptContainer') transcriptContainer!: ElementRef<HTMLDivElement>;

  // Recording state
  isRecording = signal(false);
  isPaused = signal(false);
  recordingTime = signal(0);
  hasPermission = signal(false);
  isRequestingPermission = signal(false);
  recordingComplete = signal(false);

  // Upload state
  isUploading = signal(false);
  uploadProgress = this.uploadService.uploadProgress;
  uploadError = signal<string | null>(null);

  // Toast message
  toastMessage = signal<string | null>(null);
  toastType = signal<'success' | 'error' | 'info'>('info');

  // Transcription state
  transcriptionStatus = this.transcriptionService.status;
  transcriptSegments = this.transcriptionService.displaySegments;
  enrollmentSegments = this.transcriptionService.enrollmentSegments;
  speakerMappings = this.transcriptionService.speakerMappings;
  enrolledSpeakerCount = this.transcriptionService.enrolledSpeakerCount;
  enableTranscription = signal(true);

  // Enrollment state
  isEnrolling = signal(false);
  enrollmentComplete = signal(false);

  // Manual speaker edit state
  editingSpeakerTag = signal<number | null>(null);
  editingSpeakerName = '';

  // Meeting details
  meetingTitle = '';
  meetingDescription = '';
  currentMeetingId: string | null = null;

  // Recorded audio
  recordedBlob: Blob | null = null;

  // Media recording
  private mediaRecorder: MediaRecorder | null = null;

  constructor() {
    // Auto-scroll transcript container when new segments are added
    effect(() => {
      // Access the signal to trigger the effect
      const segments = this.transcriptSegments();
      const interim = this.transcriptionService.currentInterim();

      // Scroll to bottom after a small delay to allow DOM update
      setTimeout(() => this.scrollTranscriptToBottom(), 50);
    });
  }

  private scrollTranscriptToBottom() {
    if (this.transcriptContainer?.nativeElement) {
      const container = this.transcriptContainer.nativeElement;
      container.scrollTop = container.scrollHeight;
    }
  }
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private timerInterval: any = null;
  private recordedMimeType: string = 'audio/webm'; // Store the actual MIME type used

  ngOnInit() {
    this.checkMicrophonePermission();
    // Connect to transcription service early to check availability
    this.transcriptionService.connect();
  }

  ngOnDestroy() {
    this.stopRecording();
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    this.transcriptionService.disconnect();
  }

  async checkMicrophonePermission() {
    try {
      const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      this.hasPermission.set(permissionStatus.state === 'granted');

      permissionStatus.addEventListener('change', () => {
        this.hasPermission.set(permissionStatus.state === 'granted');
      });
    } catch (error) {
      console.log('Permission API not supported, will request on start');
    }
  }

  async requestMicrophonePermission() {
    this.isRequestingPermission.set(true);

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.hasPermission.set(true);

      this.showToast('Microphone access granted!', 'success');

      // Stop the stream for now, we'll create a new one when starting recording
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    } catch (error: any) {
      console.error('Error requesting microphone permission:', error);

      let message = 'Failed to access microphone. ';
      if (error.name === 'NotAllowedError') {
        message += 'Please allow microphone access in your browser settings.';
      } else if (error.name === 'NotFoundError') {
        message += 'No microphone device found.';
      } else {
        message += 'Please check your browser settings.';
      }

      this.showToast(message, 'error');
      this.hasPermission.set(false);
    } finally {
      this.isRequestingPermission.set(false);
    }
  }

  async startRecording() {
    if (!this.meetingTitle.trim()) {
      this.showToast('Please enter a meeting title', 'error');
      return;
    }

    if (!this.hasPermission()) {
      await this.requestMicrophonePermission();
      if (!this.hasPermission()) {
        return;
      }
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Create MediaRecorder with appropriate MIME type
      const mimeType = this.getSupportedMimeType();
      this.recordedMimeType = mimeType; // Store for later use
      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });

      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.handleRecordingComplete();
      };

      this.mediaRecorder.start(1000); // Collect data every second
      this.isRecording.set(true);
      this.startTimer();

      // Start real-time transcription if enabled and user is authenticated
      const currentUser = this.authService.currentUser();
      if (this.enableTranscription() && currentUser) {
        try {
          // Reuse meeting ID from enrollment if available, otherwise create new meeting
          if (!this.currentMeetingId) {
            const meeting = await new Promise<any>((resolve, reject) => {
              this.meetingService.createMeeting(
                this.meetingTitle,
                this.meetingDescription,
                currentUser.id
              ).subscribe({
                next: (m) => resolve(m),
                error: (err) => reject(err)
              });
            });
            this.currentMeetingId = meeting.id;
          }

          // Start transcription with the stream (will load speaker mappings from enrollment)
          await this.transcriptionService.startTranscription(
            this.currentMeetingId!,
            this.stream!,
            currentUser.id
          );
          this.showToast('Recording started with live transcription', 'success');
        } catch (err) {
          console.error('Failed to start transcription:', err);
          this.showToast('Recording started (transcription unavailable)', 'info');
        }
      } else {
        this.showToast('Recording started', 'success');
      }
    } catch (error) {
      console.error('Error starting recording:', error);
      this.showToast('Failed to start recording', 'error');
    }
  }

  pauseRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
      this.isPaused.set(true);
      this.stopTimer();
      this.showToast('Recording paused', 'info');
    }
  }

  resumeRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
      this.isPaused.set(false);
      this.startTimer();
      this.showToast('Recording resumed', 'success');
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      this.isRecording.set(false);
      this.isPaused.set(false);
      this.stopTimer();

      // Stop transcription
      this.transcriptionService.stopTranscription();

      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
      }
    }
  }

  private handleRecordingComplete() {
    const audioBlob = new Blob(this.audioChunks, { type: this.recordedMimeType });
    this.recordedBlob = audioBlob;
    this.recordingComplete.set(true);

    const duration = this.recordingTime();
    const currentUser = this.authService.currentUser();

    // If user is signed in, save to backend
    if (currentUser) {
      this.saveToBackend(duration, currentUser.id);
    } else {
      this.showToast('Recording complete! Download the file or sign in to save to dashboard.', 'success');
    }
  }

  toggleTranscription() {
    this.enableTranscription.update(v => !v);
  }

  async startEnrollment() {
    if (!this.meetingTitle.trim()) {
      this.showToast('Please enter a meeting title', 'error');
      return;
    }

    if (!this.hasPermission()) {
      await this.requestMicrophonePermission();
      if (!this.hasPermission()) {
        return;
      }
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const currentUser = this.authService.currentUser();
      if (!currentUser) {
        this.showToast('Please sign in to use speaker enrollment', 'error');
        return;
      }

      // Create meeting first
      const meeting = await new Promise<any>((resolve, reject) => {
        this.meetingService.createMeeting(
          this.meetingTitle,
          this.meetingDescription,
          currentUser.id
        ).subscribe({
          next: (m) => resolve(m),
          error: (err) => reject(err)
        });
      });
      this.currentMeetingId = meeting.id;

      // Start enrollment
      await this.transcriptionService.startEnrollment(
        meeting.id,
        this.stream,
        currentUser.id
      );

      this.isEnrolling.set(true);
      this.showToast('Enrollment started. Each person should say "My name is [Name]"', 'info');
    } catch (error) {
      console.error('Error starting enrollment:', error);
      this.showToast('Failed to start enrollment', 'error');
    }
  }

  finishEnrollment() {
    this.transcriptionService.stopEnrollment();
    this.isEnrolling.set(false);
    this.enrollmentComplete.set(true);

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    const count = this.enrolledSpeakerCount();
    if (count > 0) {
      this.showToast(`${count} speaker(s) enrolled successfully!`, 'success');
    } else {
      this.showToast('No speakers enrolled. You can still record without names.', 'info');
    }
  }

  skipEnrollment() {
    this.enrollmentComplete.set(true);
  }

  restartEnrollment() {
    this.enrollmentComplete.set(false);
    this.isEnrolling.set(false);
    // Clear any existing speaker mappings for this meeting
    this.transcriptionService.clearSpeakerMappings();
  }

  startEditingSpeaker(speakerTag: number, currentName: string) {
    this.editingSpeakerTag.set(speakerTag);
    this.editingSpeakerName = currentName;
  }

  cancelEditingSpeaker() {
    this.editingSpeakerTag.set(null);
    this.editingSpeakerName = '';
  }

  saveSpeakerName() {
    const speakerTag = this.editingSpeakerTag();
    const name = this.editingSpeakerName.trim();

    if (speakerTag === null || !name || !this.currentMeetingId) {
      return;
    }

    this.transcriptionService.enrollSpeaker(this.currentMeetingId, speakerTag, name);
    this.cancelEditingSpeaker();
    this.showToast(`Speaker ${speakerTag} renamed to "${name}"`, 'success');
  }

  removeSpeaker(speakerTag: number) {
    if (!this.currentMeetingId) return;

    this.transcriptionService.removeSpeakerMapping(this.currentMeetingId, speakerTag);
    this.showToast(`Speaker ${speakerTag} removed`, 'info');
  }

  getSpeakerLabel(speakerTag: number): string {
    return this.transcriptionService.getSpeakerName(speakerTag);
  }

  getSpeakerColor(speakerTag: number): string {
    const colors = ['#007bff', '#28a745', '#dc3545', '#ffc107', '#17a2b8', '#6f42c1'];
    return colors[(speakerTag - 1) % colors.length];
  }

  private async saveToBackend(duration: number, userId: string) {
    if (!this.recordedBlob) {
      this.showToast('No recording available to upload', 'error');
      return;
    }

    this.isUploading.set(true);
    this.uploadError.set(null);

    try {
      let meetingId = this.currentMeetingId;

      // Step 1: Create meeting in backend (if not already created for transcription)
      if (!meetingId) {
        const meeting = await new Promise<any>((resolve, reject) => {
          this.meetingService.createMeeting(
            this.meetingTitle,
            this.meetingDescription,
            userId
          ).subscribe({
            next: (m) => resolve(m),
            error: (err) => reject(err)
          });
        });
        meetingId = meeting.id;
        console.log('Meeting created:', meeting);
      } else {
        console.log('Using existing meeting:', meetingId);
      }

      // Step 2: Upload audio file
      this.showToast('Uploading recording...', 'info');

      const uploadResponse = await this.uploadService.uploadAudio(
        this.recordedBlob,
        meetingId!
      );

      console.log('Upload complete:', uploadResponse);

      // Step 3: Update meeting with recording details
      await new Promise<void>((resolve, reject) => {
        this.meetingService.updateMeeting(meetingId!, {
          status: 'processing' as any,
          recordingDuration: duration,
          startedAt: new Date(Date.now() - duration * 1000),
          endedAt: new Date()
        }).subscribe({
          next: () => resolve(),
          error: (err) => reject(err)
        });
      });

      this.showToast('Recording uploaded successfully! Processing will begin shortly.', 'success');
      this.isUploading.set(false);
    } catch (error: any) {
      console.error('Error saving to backend:', error);

      const errorMessage = error.error?.message || error.message || 'Failed to upload recording';
      this.uploadError.set(errorMessage);
      this.showToast(errorMessage, 'error');
      this.isUploading.set(false);
    }
  }

  downloadRecording() {
    if (!this.recordedBlob) return;

    const url = URL.createObjectURL(this.recordedBlob);
    const extension = this.getExtensionFromMimeType(this.recordedMimeType);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.meetingTitle.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.showToast('Recording downloaded successfully!', 'success');
  }

  startNewRecording() {
    this.recordingComplete.set(false);
    this.recordedBlob = null;
    this.recordingTime.set(0);
    this.meetingTitle = '';
    this.meetingDescription = '';
    this.audioChunks = [];
    this.isUploading.set(false);
    this.uploadError.set(null);
    this.uploadService.resetProgress();
    this.currentMeetingId = null;
    this.transcriptionService.clearSegments();
    // Reset enrollment state
    this.isEnrolling.set(false);
    this.enrollmentComplete.set(false);
  }

  goToDashboard() {
    this.router.navigate(['/dashboard']);
  }

  private startTimer() {
    this.timerInterval = setInterval(() => {
      this.recordingTime.update(time => time + 1);
    }, 1000);
  }

  private stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private getExtensionFromMimeType(mimeType: string): string {
    const mimeToExt: { [key: string]: string } = {
      'audio/webm': 'webm',
      'audio/webm;codecs=opus': 'webm',
      'audio/ogg': 'ogg',
      'audio/ogg;codecs=opus': 'ogg',
      'audio/mp4': 'm4a',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav'
    };

    const baseType = mimeType.split(';')[0];
    return mimeToExt[mimeType] || mimeToExt[baseType] || 'webm';
  }

  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',   // Best for browser recording
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4'                 // Fallback only
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return 'audio/webm'; // Fallback
  }

  formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  cancel() {
    if (this.isRecording()) {
      const confirmed = confirm('Are you sure you want to cancel the recording? This cannot be undone.');
      if (!confirmed) return;

      this.stopRecording();
      this.recordingTime.set(0);
    }

    this.router.navigate(['/dashboard']);
  }

  private showToast(message: string, type: 'success' | 'error' | 'info') {
    this.toastMessage.set(message);
    this.toastType.set(type);

    // Auto hide after 3 seconds
    setTimeout(() => {
      this.toastMessage.set(null);
    }, 3000);
  }
}
