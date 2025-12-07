import { Injectable, signal, effect } from '@angular/core';

export type Theme = 'light' | 'dark';

const CURRENT_USER_KEY = 'meeting_manager_user';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly THEME_KEY = 'app-theme';

  theme = signal<Theme>(this.getInitialTheme());

  constructor() {
    effect(() => {
      const theme = this.theme();
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem(this.THEME_KEY, theme);
    });
  }

  private getInitialTheme(): Theme {
    // First, check if there's a cached user with a theme preference
    const cachedUser = localStorage.getItem(CURRENT_USER_KEY);
    if (cachedUser) {
      try {
        const user = JSON.parse(cachedUser);
        if (user.theme === 'light' || user.theme === 'dark') {
          return user.theme;
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Fall back to standalone theme preference
    const stored = localStorage.getItem(this.THEME_KEY) as Theme;
    if (stored) {
      return stored;
    }

    // Finally, use system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  }

  toggleTheme(): void {
    this.theme.update(current => current === 'light' ? 'dark' : 'light');
  }

  setTheme(theme: Theme): void {
    this.theme.set(theme);
  }
}
