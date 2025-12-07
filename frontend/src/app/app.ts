import { Component, inject, signal } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Navbar } from './components/navbar/navbar';
import { Sidebar } from './components/sidebar/sidebar';
import { filter, map } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule, Navbar, Sidebar],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);

  sidebarCollapsed = signal(false);

  hideLayout = toSignal(
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      map(() => {
        let route = this.activatedRoute;
        while (route.firstChild) {
          route = route.firstChild;
        }
        return route.snapshot.data['hideLayout'] === true;
      })
    ),
    { initialValue: false }
  );

  toggleSidebar(): void {
    this.sidebarCollapsed.update(v => !v);
  }
}
