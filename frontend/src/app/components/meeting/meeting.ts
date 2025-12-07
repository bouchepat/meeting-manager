import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { MeetingService } from '../../services/meeting.service';
import { TaskService } from '../../services/task.service';
import { UserService } from '../../services/user.service';
import { Meeting, TranscriptSegment, MeetingSummary, Task, TaskStatus, TaskPriority, User } from '../../models';
import { environment } from '../../../environments/environment';
import { ToastrService } from 'ngx-toastr';
import { forkJoin } from 'rxjs';

interface SpeakerMapping {
  speakerTag: number;
  speakerName: string;
}

@Component({
  selector: 'app-meeting',
  imports: [CommonModule, FormsModule, NgbDropdownModule],
  templateUrl: './meeting.html',
  styleUrl: './meeting.scss',
})
export class MeetingComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private meetingService = inject(MeetingService);
  private taskService = inject(TaskService);
  private userService = inject(UserService);
  private toastr = inject(ToastrService);

  meeting = signal<Meeting | null>(null);
  transcriptSegments = signal<TranscriptSegment[]>([]);
  speakerMappings = signal<SpeakerMapping[]>([]);
  tasks = signal<Task[]>([]);
  users = signal<User[]>([]);
  isLoading = signal(true);
  error = signal<string | null>(null);
  activeTab = signal<'details' | 'transcript'>('details');

  // Task editing state
  editingTaskId = signal<string | null>(null);
  editingTaskStatus = signal<TaskStatus>(TaskStatus.TODO);

  // Expose enums to template
  TaskStatus = TaskStatus;
  TaskPriority = TaskPriority;

  // Audio player state
  audioUrl = signal<string | null>(null);
  isPlaying = signal(false);

  // Speaker editing state
  editingSpeaker = signal<number | null>(null);
  editingSpeakerName = signal('');

  // AI Summary state
  aiSummary = signal<MeetingSummary | null>(null);
  isGeneratingSummary = signal(false);

  // Compute unique speakers from transcript segments
  uniqueSpeakers = computed(() => {
    const segments = this.transcriptSegments();
    const speakers = new Set<number>();
    segments.forEach(s => speakers.add(s.speakerTag));
    return Array.from(speakers).sort();
  });

  // Get speaker name by tag
  getSpeakerName(speakerTag: number): string {
    const mapping = this.speakerMappings().find(m => m.speakerTag === speakerTag);
    return mapping?.speakerName || `Speaker ${speakerTag}`;
  }

  ngOnInit() {
    const meetingId = this.route.snapshot.paramMap.get('id');
    if (meetingId) {
      this.loadMeeting(meetingId);
    } else {
      this.error.set('Meeting ID not found');
      this.isLoading.set(false);
    }
  }

  private loadMeeting(meetingId: string) {
    this.isLoading.set(true);
    this.error.set(null);

    // Load meeting details
    this.meetingService.getMeeting(meetingId).subscribe({
      next: (meeting) => {
        this.meeting.set(meeting);

        // Build audio URL if recording exists
        if (meeting.recordingUrl) {
          // The recordingUrl is relative, prepend the API base URL
          const baseUrl = environment.apiUrl.replace('/api', '');
          this.audioUrl.set(`${baseUrl}${meeting.recordingUrl}`);
        }

        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load meeting:', err);
        this.error.set('Failed to load meeting details');
        this.isLoading.set(false);
      }
    });

    // Load transcript segments
    this.meetingService.getTranscriptSegments(meetingId).subscribe({
      next: (segments) => {
        this.transcriptSegments.set(segments);
      },
      error: (err) => {
        console.error('Failed to load transcript:', err);
      }
    });

    // Load speaker mappings
    this.meetingService.getSpeakerMappings(meetingId).subscribe({
      next: (mappings) => {
        this.speakerMappings.set(mappings);
      },
      error: (err) => {
        console.error('Failed to load speaker mappings:', err);
      }
    });

    // Load AI summary
    this.meetingService.getAiSummary(meetingId).subscribe({
      next: (summary) => {
        this.aiSummary.set(summary);
      },
      error: (err) => {
        console.error('Failed to load AI summary:', err);
      }
    });

    // Load tasks for this meeting
    this.taskService.getTasksByMeeting(meetingId).subscribe({
      next: (tasks) => {
        this.tasks.set(tasks);
      },
      error: (err) => {
        console.error('Failed to load tasks:', err);
      }
    });

    // Load all users for task assignment
    this.userService.getAllUsers().subscribe({
      next: (users) => {
        this.users.set(users);
      },
      error: (err) => {
        console.error('Failed to load users:', err);
      }
    });
  }

  setActiveTab(tab: 'details' | 'transcript') {
    this.activeTab.set(tab);
  }

  // Speaker editing methods
  startEditingSpeaker(speakerTag: number) {
    this.editingSpeaker.set(speakerTag);
    this.editingSpeakerName.set(this.getSpeakerName(speakerTag));
  }

  cancelEditingSpeaker() {
    this.editingSpeaker.set(null);
    this.editingSpeakerName.set('');
  }

  saveSpeakerName(speakerTag: number) {
    const name = this.editingSpeakerName().trim();
    if (!name) {
      this.toastr.warning('Please enter a name', 'Invalid');
      return;
    }

    const meetingId = this.meeting()?.id;
    if (!meetingId) return;

    this.meetingService.setSpeakerName(meetingId, speakerTag, name).subscribe({
      next: () => {
        // Update local state
        const mappings = this.speakerMappings();
        const existingIndex = mappings.findIndex(m => m.speakerTag === speakerTag);
        if (existingIndex >= 0) {
          mappings[existingIndex].speakerName = name;
        } else {
          mappings.push({ speakerTag, speakerName: name });
        }
        this.speakerMappings.set([...mappings]);
        this.editingSpeaker.set(null);
        this.editingSpeakerName.set('');
        this.toastr.success(`Speaker ${speakerTag} renamed to ${name}`, 'Saved');
      },
      error: (err) => {
        console.error('Failed to save speaker name:', err);
        this.toastr.error('Failed to save speaker name', 'Error');
      }
    });
  }

  formatDuration(seconds: number | undefined): string {
    if (!seconds) return 'N/A';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  }

  formatDate(date: Date | string | undefined): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString();
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'completed': return 'bg-success';
      case 'processing': return 'bg-warning text-dark';
      case 'recording': return 'bg-danger';
      case 'failed': return 'bg-secondary';
      default: return 'bg-secondary';
    }
  }

  getSpeakerColor(speakerTag: number): string {
    const colors = ['#007bff', '#28a745', '#dc3545', '#ffc107', '#17a2b8', '#6f42c1'];
    return colors[(speakerTag - 1) % colors.length];
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }

  deleteMeeting() {
    const meeting = this.meeting();
    if (!meeting) return;

    if (confirm(`Are you sure you want to delete "${meeting.title}"? This cannot be undone.`)) {
      this.meetingService.deleteMeeting(meeting.id).subscribe({
        next: () => {
          this.router.navigate(['/dashboard']);
        },
        error: (err) => {
          console.error('Failed to delete meeting:', err);
          this.error.set('Failed to delete meeting');
        }
      });
    }
  }

  generateSummary() {
    const meeting = this.meeting();
    if (!meeting) return;

    this.isGeneratingSummary.set(true);
    this.meetingService.generateAiSummary(meeting.id).subscribe({
      next: (result) => {
        this.aiSummary.set(result.summary);
        this.isGeneratingSummary.set(false);
        this.toastr.success(`Summary generated with ${result.tasksCreated} tasks`, 'AI Summary Ready');
        // Reload tasks after generating summary (AI creates tasks)
        if (result.tasksCreated > 0) {
          this.taskService.getTasksByMeeting(meeting.id).subscribe({
            next: (tasks) => this.tasks.set(tasks)
          });
        }
      },
      error: (err) => {
        console.error('Failed to generate summary:', err);
        this.isGeneratingSummary.set(false);
        this.toastr.error(err.error?.message || 'Failed to generate summary', 'Error');
      }
    });
  }

  // Task methods
  getTaskStatusBadgeClass(status: TaskStatus): string {
    switch (status) {
      case TaskStatus.TODO: return 'bg-secondary';
      case TaskStatus.IN_PROGRESS: return 'bg-primary';
      case TaskStatus.DONE: return 'bg-success';
      default: return 'bg-secondary';
    }
  }

  getTaskPriorityBadgeClass(priority: TaskPriority): string {
    switch (priority) {
      case TaskPriority.LOW: return 'text-bg-info';
      case TaskPriority.MEDIUM: return 'text-bg-warning';
      case TaskPriority.HIGH: return 'text-bg-danger';
      default: return 'text-bg-secondary';
    }
  }

  updateTaskStatus(task: Task, newStatus: TaskStatus) {
    this.taskService.updateTask(task.id, { status: newStatus }).subscribe({
      next: (updatedTask) => {
        // Update local state
        const currentTasks = this.tasks();
        const index = currentTasks.findIndex(t => t.id === task.id);
        if (index >= 0) {
          currentTasks[index] = updatedTask;
          this.tasks.set([...currentTasks]);
        }
        this.toastr.success(`Task status updated to ${newStatus.replace('_', ' ')}`, 'Updated');
      },
      error: (err) => {
        console.error('Failed to update task:', err);
        this.toastr.error('Failed to update task status', 'Error');
      }
    });
  }

  updateTaskAssignee(task: Task, userId: string | null) {
    this.taskService.updateTask(task.id, { assigneeId: userId || undefined } as Partial<Task>).subscribe({
      next: (updatedTask) => {
        // Update local state
        const currentTasks = this.tasks();
        const index = currentTasks.findIndex(t => t.id === task.id);
        if (index >= 0) {
          currentTasks[index] = updatedTask;
          this.tasks.set([...currentTasks]);
        }
        const assigneeName = updatedTask.assignee?.displayName || 'Unassigned';
        this.toastr.success(`Task assigned to ${assigneeName}`, 'Updated');
      },
      error: (err) => {
        console.error('Failed to update task assignee:', err);
        this.toastr.error('Failed to update task assignee', 'Error');
      }
    });
  }

  deleteTask(task: Task) {
    if (!confirm(`Delete task "${task.title}"?`)) return;

    this.taskService.deleteTask(task.id).subscribe({
      next: () => {
        this.tasks.set(this.tasks().filter(t => t.id !== task.id));
        this.toastr.success('Task deleted', 'Deleted');
      },
      error: (err) => {
        console.error('Failed to delete task:', err);
        this.toastr.error('Failed to delete task', 'Error');
      }
    });
  }

  formatTaskDueDate(date: Date | string | undefined): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString();
  }

  isTaskOverdue(task: Task): boolean {
    if (!task.dueDate || task.status === TaskStatus.DONE) return false;
    return new Date(task.dueDate) < new Date();
  }
}
