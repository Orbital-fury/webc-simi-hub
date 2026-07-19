import { Routes } from '@angular/router';

import { PluginContainer } from './features/plugin-container/plugin-container';

export const routes: Routes = [
  // Strategie wildcard : le premier segment identifie le plugin (routePath du
  // manifeste), le reste du chemin devient sa sous-route interne (`subRoute`).
  { path: '**', component: PluginContainer },
];
