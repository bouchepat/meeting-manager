import { Injectable, inject, signal } from '@angular/core';
import { Auth, signInWithPopup, GoogleAuthProvider, signOut, user, User as FirebaseUser } from '@angular/fire/auth';
import { Router } from '@angular/router';
import { Observable, firstValueFrom } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { User } from '../models';

const JWT_TOKEN_KEY = 'meeting_manager_jwt';
const CURRENT_USER_KEY = 'meeting_manager_user';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth: Auth = inject(Auth);
  private router = inject(Router);
  private http = inject(HttpClient);

  user$ = user(this.auth);
  currentUser = signal<User | null>(null);
  private jwtToken = signal<string | null>(null);

  constructor() {
    // Load cached token and user from localStorage
    this.loadCachedAuth();

    // Listen for Firebase auth state changes
    this.user$.subscribe(async (firebaseUser) => {
      if (firebaseUser) {
        // User is signed in with Firebase
        console.log('Firebase user signed in:', firebaseUser.email);

        // Ensure we have a JWT token (backend will create user if needed)
        if (!this.jwtToken()) {
          console.log('No cached JWT token, getting new one...');
          await this.getToken();
        }
      } else {
        // User is signed out
        console.log('No Firebase user');
        this.currentUser.set(null);
        this.jwtToken.set(null);
        localStorage.removeItem(JWT_TOKEN_KEY);
        localStorage.removeItem(CURRENT_USER_KEY);
      }
    });
  }

  /**
   * Load cached authentication data from localStorage
   */
  private loadCachedAuth(): void {
    const cachedToken = localStorage.getItem(JWT_TOKEN_KEY);
    const cachedUser = localStorage.getItem(CURRENT_USER_KEY);

    if (cachedToken) {
      this.jwtToken.set(cachedToken);
    }

    if (cachedUser) {
      try {
        const user = JSON.parse(cachedUser);
        this.currentUser.set(user);
      } catch (error) {
        console.error('Error parsing cached user:', error);
        localStorage.removeItem(CURRENT_USER_KEY);
      }
    }
  }

  async signInWithGoogle(): Promise<void> {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(this.auth, provider);
      if (result.user) {
        // Get JWT token (backend will create user if needed)
        const token = await this.getToken();

        if (token) {
          console.log('Successfully authenticated and got JWT token');
          this.router.navigate(['/dashboard']);
        } else {
          throw new Error('Failed to get authentication token');
        }
      }
    } catch (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  }

  async signOut(): Promise<void> {
    try {
      await signOut(this.auth);
      this.currentUser.set(null);
      this.jwtToken.set(null);

      // Clear localStorage
      localStorage.removeItem(JWT_TOKEN_KEY);
      localStorage.removeItem(CURRENT_USER_KEY);

      this.router.navigate(['/']);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  }

  getCurrentUser(): Observable<User | null> {
    return new Observable(observer => {
      observer.next(this.currentUser());
      observer.complete();
    });
  }

  /**
   * Get Firebase ID token and generate JWT
   * Returns cached token if available, otherwise generates new one
   */
  async getToken(): Promise<string | null> {
    // Return cached token if available
    const cachedToken = this.jwtToken();
    if (cachedToken) {
      return cachedToken;
    }

    const firebaseUser = this.auth.currentUser;
    if (!firebaseUser) {
      console.log('No Firebase user, cannot get token');
      return null;
    }

    try {
      // Get Firebase ID token
      const idToken = await firebaseUser.getIdToken();
      console.log('Got Firebase ID token, exchanging for JWT...');

      // Generate JWT from backend using Firebase token
      const response = await firstValueFrom(
        this.http.post<{ token: string; user: User }>(
          `${environment.apiUrl}/auth/login`,
          { firebaseToken: idToken }
        )
      );

      if (response?.token) {
        console.log('Got JWT token and user data:', response.user);

        // Store token
        this.jwtToken.set(response.token);
        localStorage.setItem(JWT_TOKEN_KEY, response.token);

        // Store user data
        this.currentUser.set(response.user);
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(response.user));

        return response.token;
      }

      return null;
    } catch (error) {
      console.error('Error getting token:', error);
      return null;
    }
  }

  /**
   * Get Firebase ID token directly (for backend JWT validation)
   */
  async getFirebaseToken(): Promise<string | null> {
    const firebaseUser = this.auth.currentUser;
    if (!firebaseUser) {
      return null;
    }

    try {
      return await firebaseUser.getIdToken();
    } catch (error) {
      console.error('Error getting Firebase token:', error);
      return null;
    }
  }

  /**
   * Get cached JWT token
   */
  getJwtToken(): string | null {
    return this.jwtToken();
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.auth.currentUser && !!this.currentUser();
  }

  /**
   * Update the current user data (e.g., after settings change)
   */
  updateCurrentUser(user: User): void {
    this.currentUser.set(user);
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  }
}
