import { Routes } from '@angular/router';
import { Home } from './components/home/home';
import { Dashboard } from './components/dashboard/dashboard';
import { MeetingComponent } from './components/meeting/meeting';
import { Recorder } from './components/recorder/recorder';
import { Profile } from './components/profile/profile';
import { Settings } from './components/settings/settings';
import { MyTasksComponent } from './components/my-tasks/my-tasks';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', component: Home, data: { title: 'Home', hideLayout: true } },
  { path: 'dashboard', component: Dashboard, data: { title: 'Dashboard' }, canActivate: [authGuard] },
  { path: 'meeting/record', component: Recorder, data: { title: 'New Recording' }, canActivate: [authGuard] },
  { path: 'meeting/:id', component: MeetingComponent, data: { title: 'Meeting Details' }, canActivate: [authGuard] },
  { path: 'my-tasks', component: MyTasksComponent, data: { title: 'My Tasks' }, canActivate: [authGuard] },
  { path: 'profile', component: Profile, data: { title: 'Profile' }, canActivate: [authGuard] },
  { path: 'settings', component: Settings, data: { title: 'Settings' }, canActivate: [authGuard] },
  { path: '**', redirectTo: '' }
];
