import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Meeting, Guest, MeetingSummary, TranscriptSegment } from '../models';

@Injectable({
  providedIn: 'root'
})
export class MeetingService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/meetings`;

  createMeeting(title: string, description: string, creatorId: string): Observable<Meeting> {
    return this.http.post<Meeting>(this.apiUrl, { title, description, creatorId });
  }

  getAllMeetings(): Observable<Meeting[]> {
    return this.http.get<Meeting[]>(this.apiUrl);
  }

  getMeetingsByUser(userId: string): Observable<Meeting[]> {
    return this.http.get<Meeting[]>(`${this.apiUrl}/user/${userId}`);
  }

  getMeeting(id: string): Observable<Meeting> {
    return this.http.get<Meeting>(`${this.apiUrl}/${id}`);
  }

  updateMeeting(id: string, data: Partial<Meeting>): Observable<Meeting> {
    return this.http.patch<Meeting>(`${this.apiUrl}/${id}`, data);
  }

  endMeeting(id: string): Observable<Meeting> {
    return this.http.post<Meeting>(`${this.apiUrl}/${id}/end`, {});
  }

  addGuest(meetingId: string, guest: Partial<Guest>): Observable<Guest> {
    return this.http.post<Guest>(`${this.apiUrl}/${meetingId}/guests`, guest);
  }

  addSummary(meetingId: string, summary: Partial<MeetingSummary>): Observable<MeetingSummary> {
    return this.http.post<MeetingSummary>(`${this.apiUrl}/${meetingId}/summary`, summary);
  }

  deleteMeeting(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  getTranscriptSegments(meetingId: string): Observable<TranscriptSegment[]> {
    return this.http.get<TranscriptSegment[]>(`${this.apiUrl}/${meetingId}/transcript`);
  }

  getFullTranscript(meetingId: string): Observable<string> {
    return this.http.get(`${this.apiUrl}/${meetingId}/transcript/full`, { responseType: 'text' });
  }

  // Speaker mapping
  getSpeakerMappings(meetingId: string): Observable<{ speakerTag: number; speakerName: string }[]> {
    return this.http.get<{ speakerTag: number; speakerName: string }[]>(`${this.apiUrl}/${meetingId}/speakers`);
  }

  setSpeakerName(meetingId: string, speakerTag: number, speakerName: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${meetingId}/speakers`, { speakerTag, speakerName });
  }

  // AI Summary
  getAiSummary(meetingId: string): Observable<MeetingSummary | null> {
    return this.http.get<MeetingSummary | null>(`${this.apiUrl}/${meetingId}/ai-summary`);
  }

  generateAiSummary(meetingId: string): Observable<{ summary: MeetingSummary; tasksCreated: number; tasks: any[] }> {
    return this.http.post<{ summary: MeetingSummary; tasksCreated: number; tasks: any[] }>(`${this.apiUrl}/${meetingId}/summarize`, {});
  }
}
