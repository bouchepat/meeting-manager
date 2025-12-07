import { Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd, ActivatedRoute } from '@angular/router';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { AuthService } from '../../services/auth.service';
import { filter, map } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-navbar',
  imports: [CommonModule, RouterModule, NgbDropdownModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar {
  private authService = inject(AuthService);
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);

  user$ = this.authService.user$;

  pageTitle = toSignal(
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      map(() => {
        let route = this.activatedRoute;
        while (route.firstChild) {
          route = route.firstChild;
        }
        return route.snapshot.data['title'] || 'Meeting Manager';
      })
    ),
    { initialValue: 'Meeting Manager' }
  );

  sidebarToggled = output<void>();

  toggleSidebar(): void {
    this.sidebarToggled.emit();
  }

  signIn(): void {
    this.authService.signInWithGoogle();
  }

  async signOut(): Promise<void> {
    await this.authService.signOut();
    this.router.navigate(['/']);
  }
}
