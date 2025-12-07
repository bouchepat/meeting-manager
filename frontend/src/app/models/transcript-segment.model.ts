export interface TranscriptSegment {
  id: string;
  meetingId: string;
  speakerTag: number;
  speakerName?: string;
  transcript: string;
  confidence?: number;
  startTime: number;
  endTime: number;
  isFinal: boolean;
  createdAt: Date;
}
