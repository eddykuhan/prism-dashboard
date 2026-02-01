import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { LogsComponent } from './features/logs/logs.component';

export const routes: Routes = [
    { path: '', redirectTo: 'metrics', pathMatch: 'full' },
    { path: 'logs', component: LogsComponent },
    { path: 'metrics', loadComponent: () => import('./features/metrics/metrics.component').then(m => m.MetricsComponent) },
    { path: 'traces', loadComponent: () => import('./features/traces/traces.component').then(m => m.TracesComponent) },
    { path: '**', redirectTo: '' }
];
