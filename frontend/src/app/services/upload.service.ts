import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpEvent, HttpEventType } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

export interface UploadProgress {
  uploadId: string;
  currentChunk: number;
  totalChunks: number;
  percentage: number;
  status: 'uploading' | 'complete' | 'error';
  error?: string;
}

export interface UploadResponse {
  status: string;
  meetingId?: string;
  fileName?: string;
  fileSize?: number;
  message?: string;
  chunkIndex?: number;
  uploadId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class UploadService {
  private http = inject(HttpClient);

  // Track upload progress
  uploadProgress = signal<UploadProgress | null>(null);

  /**
   * Upload audio file using chunked upload
   * Splits file into 5MB chunks and uploads sequentially
   */
  async uploadAudioChunked(
    audioBlob: Blob,
    meetingId: string
  ): Promise<UploadResponse> {
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
    const totalChunks = Math.ceil(audioBlob.size / CHUNK_SIZE);
    const uploadId = this.generateUploadId();

    console.log(`Starting chunked upload for meeting ${meetingId}`);
    console.log(`File size: ${audioBlob.size} bytes, Chunks: ${totalChunks}`);

    // Initialize progress tracking
    this.uploadProgress.set({
      uploadId,
      currentChunk: 0,
      totalChunks,
      percentage: 0,
      status: 'uploading'
    });

    try {
      let lastResponse: UploadResponse | null = null;

      // Upload each chunk sequentially
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, audioBlob.size);
        const chunk = audioBlob.slice(start, end);

        console.log(`Uploading chunk ${i + 1}/${totalChunks} (${chunk.size} bytes)`);

        // Upload chunk
        lastResponse = await this.uploadChunk(
          chunk,
          uploadId,
          i,
          totalChunks,
          meetingId
        );

        // Update progress
        const percentage = Math.round(((i + 1) / totalChunks) * 100);
        this.uploadProgress.update(progress => progress ? {
          ...progress,
          currentChunk: i + 1,
          percentage
        } : null);
      }

      // Upload complete
      this.uploadProgress.update(progress => progress ? {
        ...progress,
        status: 'complete',
        percentage: 100
      } : null);

      console.log('Upload complete!', lastResponse);
      return lastResponse!;
    } catch (error: any) {
      console.error('Upload failed:', error);

      // Update progress with error
      this.uploadProgress.update(progress => progress ? {
        ...progress,
        status: 'error',
        error: error.message || 'Upload failed'
      } : null);

      throw error;
    }
  }

  /**
   * Upload a single chunk
   */
  private uploadChunk(
    chunk: Blob,
    uploadId: string,
    chunkIndex: number,
    totalChunks: number,
    meetingId: string
  ): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('chunk', chunk);
    formData.append('uploadId', uploadId);
    formData.append('chunkIndex', chunkIndex.toString());
    formData.append('totalChunks', totalChunks.toString());
    formData.append('meetingId', meetingId);

    return new Promise((resolve, reject) => {
      this.http.post<UploadResponse>(
        `${environment.apiUrl}/uploads/audio/chunk`,
        formData
      ).subscribe({
        next: (response) => resolve(response),
        error: (error) => reject(error)
      });
    });
  }

  /**
   * Upload complete file (non-chunked, for smaller files)
   * Use this for files < 50MB
   */
  async uploadAudioComplete(
    audioBlob: Blob,
    meetingId: string
  ): Promise<UploadResponse> {
    console.log(`Uploading complete file for meeting ${meetingId}`);
    console.log(`File size: ${audioBlob.size} bytes`);

    const formData = new FormData();
    // Create a File from Blob with proper filename and extension
    const extension = this.getExtensionFromMimeType(audioBlob.type);
    const audioFile = new File([audioBlob], `recording.${extension}`, { type: audioBlob.type });
    formData.append('audio', audioFile);
    formData.append('meetingId', meetingId);

    return new Promise((resolve, reject) => {
      this.http.post<UploadResponse>(
        `${environment.apiUrl}/uploads/audio/complete`,
        formData
      ).subscribe({
        next: (response) => resolve(response),
        error: (error) => reject(error)
      });
    });
  }

  /**
   * Upload audio file - automatically chooses chunked or complete upload
   * based on file size
   */
  async uploadAudio(
    audioBlob: Blob,
    meetingId: string
  ): Promise<UploadResponse> {
    const FILE_SIZE_THRESHOLD = 50 * 1024 * 1024; // 50MB

    if (audioBlob.size > FILE_SIZE_THRESHOLD) {
      return this.uploadAudioChunked(audioBlob, meetingId);
    } else {
      return this.uploadAudioComplete(audioBlob, meetingId);
    }
  }

  /**
   * Generate unique upload ID
   */
  private generateUploadId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Reset upload progress
   */
  resetProgress(): void {
    this.uploadProgress.set(null);
  }

  /**
   * Get file extension from MIME type
   */
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

    // Try exact match first
    if (mimeToExt[mimeType]) {
      return mimeToExt[mimeType];
    }

    // Try base type without codecs
    const baseType = mimeType.split(';')[0];
    if (mimeToExt[baseType]) {
      return mimeToExt[baseType];
    }

    // Default fallback
    return 'webm';
  }
}
