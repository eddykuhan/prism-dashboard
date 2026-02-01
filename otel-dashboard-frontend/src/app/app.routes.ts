import { Routes } from '@angular/router';
import { LogsComponent } from './features/logs/logs.component';

export const routes: Routes = [
    { path: '', loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent), pathMatch: 'full' },
    { path: 'home', redirectTo: '', pathMatch: 'full' },
    { path: 'logs', component: LogsComponent },
    { path: 'metrics', loadComponent: () => import('./features/metrics/metrics.component').then(m => m.MetricsComponent) },
    { path: 'traces', loadComponent: () => import('./features/traces/traces.component').then(m => m.TracesComponent) },
    { path: 'guide', loadComponent: () => import('./features/guide/guide.component').then(m => m.GuideComponent) },
    { path: '**', redirectTo: '' }
];
