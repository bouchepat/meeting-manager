export interface Guest {
  id: string;
  name: string;
  email?: string;
  role?: string;
  isAiDetected: boolean;
  meetingId: string;
  createdAt: Date;
}
