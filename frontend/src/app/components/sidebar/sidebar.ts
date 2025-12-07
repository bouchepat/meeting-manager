import { Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-sidebar',
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  private authService = inject(AuthService);

  user$ = this.authService.user$;
  currentUser = this.authService.currentUser;

  menuItems = [
    { label: 'Dashboard', icon: 'bi-grid', route: '/dashboard' },
    { label: 'My Tasks', icon: 'bi-list-task', route: '/my-tasks' },
    { label: 'New Recording', icon: 'bi-mic', route: '/meeting/record' },
  ];
}
