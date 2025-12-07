import { Injectable, inject, signal, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { User, UserSettings } from '../models';
import { AuthService } from './auth.service';
import { ThemeService } from './theme.service';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private themeService = inject(ThemeService);

  // Local settings state
  enableTranscription = signal(true);
  autoSaveRecordings = signal(true);
  notificationsEnabled = signal(true);
  audioQuality = signal<'low' | 'medium' | 'high'>('high');

  private initialized = false;

  constructor() {
    // When currentUser changes, load their settings
    effect(() => {
      const user = this.authService.currentUser();
      if (user && !this.initialized) {
        this.loadSettingsFromUser(user);
        this.initialized = true;
      } else if (!user) {
        this.initialized = false;
      }
    });
  }

  /**
   * Load settings from user object
   */
  loadSettingsFromUser(user: User): void {
    this.enableTranscription.set(user.enableTranscription ?? true);
    this.autoSaveRecordings.set(user.autoSaveRecordings ?? true);
    this.notificationsEnabled.set(user.notificationsEnabled ?? true);
    this.audioQuality.set(user.audioQuality ?? 'high');

    // Apply theme
    if (user.theme) {
      this.themeService.setTheme(user.theme);
    }
  }

  /**
   * Save settings to the backend
   */
  async saveSettings(): Promise<User> {
    const settings: UserSettings = {
      enableTranscription: this.enableTranscription(),
      autoSaveRecordings: this.autoSaveRecordings(),
      notificationsEnabled: this.notificationsEnabled(),
      theme: this.themeService.theme(),
      audioQuality: this.audioQuality()
    };

    const updatedUser = await firstValueFrom(
      this.http.patch<User>(`${environment.apiUrl}/users/me/settings`, settings)
    );

    // Update the currentUser in AuthService
    this.authService.updateCurrentUser(updatedUser);

    return updatedUser;
  }

  /**
   * Reset settings to defaults
   */
  resetToDefaults(): void {
    this.enableTranscription.set(true);
    this.autoSaveRecordings.set(true);
    this.notificationsEnabled.set(true);
    this.audioQuality.set('high');
    this.themeService.setTheme('dark');
  }
}
