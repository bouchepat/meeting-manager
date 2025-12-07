import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Task } from '../models';

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/tasks`;

  createTask(task: Partial<Task>): Observable<Task> {
    return this.http.post<Task>(this.apiUrl, task);
  }

  getAllTasks(): Observable<Task[]> {
    return this.http.get<Task[]>(this.apiUrl);
  }

  getTasksByMeeting(meetingId: string): Observable<Task[]> {
    return this.http.get<Task[]>(`${this.apiUrl}/meeting/${meetingId}`);
  }

  getTasksByAssignee(assigneeId: string): Observable<Task[]> {
    return this.http.get<Task[]>(`${this.apiUrl}/assignee/${assigneeId}`);
  }

  getTask(id: string): Observable<Task> {
    return this.http.get<Task>(`${this.apiUrl}/${id}`);
  }

  updateTask(id: string, data: Partial<Task>): Observable<Task> {
    return this.http.patch<Task>(`${this.apiUrl}/${id}`, data);
  }

  deleteTask(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
