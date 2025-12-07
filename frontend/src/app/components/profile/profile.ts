import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../../environments/environment';

interface UserStats {
  totalRecordings: number;
  totalDurationSeconds: number;
  memberSince: string;
}

@Component({
  selector: 'app-profile',
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class Profile implements OnInit {
  private authService = inject(AuthService);
  private toastr = inject(ToastrService);
  private http = inject(HttpClient);

  user$ = this.authService.user$;
  currentUser = this.authService.currentUser;

  // Activity stats
  stats = signal<UserStats | null>(null);
  loadingStats = signal(false);

  // For future editable fields
  displayName = '';
  email = '';

  ngOnInit() {
    const user = this.currentUser();
    if (user) {
      this.displayName = user.displayName || '';
      this.email = user.email || '';
      this.loadStats();
    }
  }

  loadStats() {
    this.loadingStats.set(true);
    this.http.get<UserStats>(`${environment.apiUrl}/users/me/stats`).subscribe({
      next: (stats) => {
        this.stats.set(stats);
        this.loadingStats.set(false);
      },
      error: (error) => {
        console.error('Failed to load stats:', error);
        this.loadingStats.set(false);
      }
    });
  }

  formatDuration(totalSeconds: number): string {
    if (!totalSeconds) return '0m';

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  formatDate(dateString: string): string {
    if (!dateString) return '--';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }

  saveProfile() {
    // Placeholder for future profile update functionality
    this.toastr.info('Profile updates will be available soon', 'Coming Soon');
  }
}
