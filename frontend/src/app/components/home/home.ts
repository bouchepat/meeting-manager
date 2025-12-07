import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-home',
  imports: [CommonModule, RouterModule],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private authService = inject(AuthService);

  user$ = this.authService.user$;

  signIn(): void {
    this.authService.signInWithGoogle();
  }
}
