import { Component, inject, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';
import { ThemeService } from '../../services/theme.service';
import { SettingsService } from '../../services/settings.service';
import { environment } from '../../../environments/environment';

interface StorageStats {
  usedBytes: number;
  recordingCount: number;
}

@Component({
  selector: 'app-settings',
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings implements OnInit {
  private http = inject(HttpClient);
  private toastr = inject(ToastrService);
  private themeService = inject(ThemeService);
  settingsService = inject(SettingsService);

  saving = false;

  // Storage stats
  storageStats = signal<StorageStats | null>(null);
  loadingStorage = signal(false);

  // Theme state from service
  isDarkMode = computed(() => this.themeService.theme() === 'dark');

  ngOnInit() {
    this.loadStorageStats();
  }

  loadStorageStats() {
    this.loadingStorage.set(true);
    this.http.get<StorageStats>(`${environment.apiUrl}/users/me/storage`).subscribe({
      next: (stats) => {
        this.storageStats.set(stats);
        this.loadingStorage.set(false);
      },
      error: (error) => {
        console.error('Failed to load storage stats:', error);
        this.loadingStorage.set(false);
      }
    });
  }

  toggleDarkMode() {
    this.themeService.toggleTheme();
  }

  async saveSettings() {
    this.saving = true;
    try {
      await this.settingsService.saveSettings();
      this.toastr.success('Settings saved successfully', 'Saved');
    } catch (error) {
      console.error('Failed to save settings:', error);
      this.toastr.error('Failed to save settings', 'Error');
    } finally {
      this.saving = false;
    }
  }

  resetSettings() {
    this.settingsService.resetToDefaults();
    this.toastr.info('Settings reset to defaults', 'Reset');
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}
