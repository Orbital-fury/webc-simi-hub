import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { GlobalPluginBridge } from './core/services/global-plugin-bridge';
import { HeaderComponent } from './features/header/header';

/**
 * Shell du Hub : route les plugins via `<router-outlet>` (voir
 * `PluginContainer`) et rend les actions ephemeres globales relayees par les
 * plugins (`GlobalPluginBridge`) : toasts et modale globale.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HeaderComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class App {
  protected readonly bridge = inject(GlobalPluginBridge);
}
