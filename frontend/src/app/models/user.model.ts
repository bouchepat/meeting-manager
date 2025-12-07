export interface User {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  firebaseUid: string;
  // Settings
  enableTranscription: boolean;
  autoSaveRecordings: boolean;
  notificationsEnabled: boolean;
  theme: 'dark' | 'light';
  audioQuality: 'low' | 'medium' | 'high';
  createdAt: Date;
  updatedAt: Date;
}

export interface UserSettings {
  enableTranscription?: boolean;
  autoSaveRecordings?: boolean;
  notificationsEnabled?: boolean;
  theme?: 'dark' | 'light';
  audioQuality?: 'low' | 'medium' | 'high';
}
