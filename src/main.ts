// Effet de bord : enregistre une seule fois tous les Custom Elements simi-*
// (garde interne `customElements.get(tag)`, sans risque de redefinition).
import 'webc-simi-ui';

import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
