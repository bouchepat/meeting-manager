export interface MeetingSummary {
  id: string;
  summary: string;
  keyPoints?: string[];
  decisions?: string[];
  actionItems?: string[];
  isAiGenerated: boolean;
  meetingId: string;
  createdAt: Date;
}
