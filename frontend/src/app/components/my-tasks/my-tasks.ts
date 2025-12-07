import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { TaskService } from '../../services/task.service';
import { AuthService } from '../../services/auth.service';
import { Task, TaskStatus, TaskPriority } from '../../models';

@Component({
  selector: 'app-my-tasks',
  imports: [CommonModule, FormsModule],
  templateUrl: './my-tasks.html',
  styleUrl: './my-tasks.scss',
})
export class MyTasksComponent implements OnInit {
  private taskService = inject(TaskService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private toastr = inject(ToastrService);

  tasks = signal<Task[]>([]);
  isLoading = signal(true);
  error = signal<string | null>(null);
  searchQuery = signal('');
  statusFilter = signal<TaskStatus | 'all'>('all');

  // Expose enums to template
  TaskStatus = TaskStatus;
  TaskPriority = TaskPriority;

  // Computed filtered tasks
  filteredTasks = computed(() => {
    let result = this.tasks();

    // Filter by status
    const status = this.statusFilter();
    if (status !== 'all') {
      result = result.filter(t => t.status === status);
    }

    // Filter by search
    const query = this.searchQuery().toLowerCase().trim();
    if (query) {
      result = result.filter(t =>
        t.title.toLowerCase().includes(query) ||
        (t.description && t.description.toLowerCase().includes(query))
      );
    }

    return result;
  });

  // Computed task counts by status
  taskCounts = computed(() => {
    const tasks = this.tasks();
    return {
      all: tasks.length,
      todo: tasks.filter(t => t.status === TaskStatus.TODO).length,
      inProgress: tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length,
      done: tasks.filter(t => t.status === TaskStatus.DONE).length,
    };
  });

  ngOnInit() {
    this.loadTasks();
  }

  loadTasks(showToast = false) {
    this.isLoading.set(true);
    this.error.set(null);

    const currentUser = this.authService.currentUser();
    if (!currentUser) {
      this.error.set('User not authenticated');
      this.isLoading.set(false);
      return;
    }

    this.taskService.getTasksByAssignee(currentUser.id).subscribe({
      next: (tasks) => {
        // Sort by priority (high first), then by due date
        this.tasks.set(tasks.sort((a, b) => {
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          const aPriority = priorityOrder[a.priority] ?? 2;
          const bPriority = priorityOrder[b.priority] ?? 2;
          if (aPriority !== bPriority) return aPriority - bPriority;

          // Then by due date (earlier first)
          if (a.dueDate && b.dueDate) {
            return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
          }
          if (a.dueDate) return -1;
          if (b.dueDate) return 1;
          return 0;
        }));
        this.isLoading.set(false);
        if (showToast) {
          this.toastr.success('Tasks refreshed', 'Updated');
        }
      },
      error: (err) => {
        console.error('Error loading tasks:', err);
        this.error.set('Failed to load tasks');
        this.isLoading.set(false);
        this.toastr.error('Failed to load tasks', 'Error');
      }
    });
  }

  setStatusFilter(status: TaskStatus | 'all') {
    this.statusFilter.set(status);
  }

  clearSearch() {
    this.searchQuery.set('');
  }

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

  viewMeeting(meetingId: string) {
    this.router.navigate(['/meeting', meetingId]);
  }

  formatDueDate(date: Date | string | undefined): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString();
  }

  isTaskOverdue(task: Task): boolean {
    if (!task.dueDate || task.status === TaskStatus.DONE) return false;
    return new Date(task.dueDate) < new Date();
  }
}
