import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import { MeetingService } from '../../services/meeting.service';
import { Meeting, MeetingStatus } from '../../models/meeting.model';
import { ConfirmModalComponent } from '../confirm-modal/confirm-modal';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  private meetingService = inject(MeetingService);
  private router = inject(Router);
  private modalService = inject(NgbModal);
  private toastr = inject(ToastrService);

  meetings: Meeting[] = [];
  filteredMeetings: Meeting[] = [];
  searchQuery = '';
  loading = true;
  error: string | null = null;

  ngOnInit() {
    this.loadMeetings();
  }

  loadMeetings(showToast = false) {
    this.loading = true;
    this.error = null;

    this.meetingService.getAllMeetings().subscribe({
      next: (meetings) => {
        this.meetings = meetings.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        this.filterMeetings();
        this.loading = false;
        if (showToast) {
          this.toastr.success('Meetings refreshed', 'Updated');
        }
      },
      error: (err) => {
        console.error('Error loading meetings:', err);
        this.error = 'Failed to load meetings. Please try again.';
        this.loading = false;
        this.toastr.error('Failed to load meetings', 'Error');
      }
    });
  }

  filterMeetings() {
    if (!this.searchQuery.trim()) {
      this.filteredMeetings = [...this.meetings];
      return;
    }

    const query = this.searchQuery.toLowerCase().trim();
    this.filteredMeetings = this.meetings.filter(meeting =>
      meeting.title.toLowerCase().includes(query) ||
      (meeting.description && meeting.description.toLowerCase().includes(query)) ||
      (meeting.creator?.displayName && meeting.creator.displayName.toLowerCase().includes(query))
    );
  }

  clearSearch() {
    this.searchQuery = '';
    this.filterMeetings();
  }

  getStatusColor(status: MeetingStatus): string {
    switch (status) {
      case MeetingStatus.RECORDING:
        return 'danger';
      case MeetingStatus.PROCESSING:
        return 'warning';
      case MeetingStatus.COMPLETED:
        return 'success';
      case MeetingStatus.FAILED:
        return 'danger';
      default:
        return 'secondary';
    }
  }

  formatDuration(seconds: number | undefined): string {
    if (!seconds) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  formatDate(date: Date | undefined): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  startNewRecording() {
    this.router.navigate(['/meeting/record']);
  }

  viewMeeting(id: string) {
    this.router.navigate(['/meeting', id]);
  }

  async deleteMeeting(meeting: Meeting, event: Event) {
    event.stopPropagation(); // Prevent card click

    const modalRef = this.modalService.open(ConfirmModalComponent, {
      centered: true,
      backdrop: 'static',
    });

    modalRef.componentInstance.title = 'Delete Recording';
    modalRef.componentInstance.message = `Are you sure you want to delete <strong>"${meeting.title}"</strong>? This action cannot be undone.`;
    modalRef.componentInstance.confirmText = 'Delete';
    modalRef.componentInstance.cancelText = 'Cancel';
    modalRef.componentInstance.type = 'danger';
    modalRef.componentInstance.confirmIconClass = 'bi-trash me-1';

    try {
      const result = await modalRef.result;
      if (result) {
        this.meetingService.deleteMeeting(meeting.id).subscribe({
          next: () => {
            this.meetings = this.meetings.filter(m => m.id !== meeting.id);
            this.filterMeetings();
            this.toastr.success('Recording deleted successfully', 'Deleted');
          },
          error: (err) => {
            console.error('Error deleting meeting:', err);
            this.toastr.error('Failed to delete recording. Please try again.', 'Error');
          }
        });
      }
    } catch {
      // Modal was dismissed, do nothing
    }
  }
}
