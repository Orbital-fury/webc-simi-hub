import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { PluginManifestEntry } from '../../core/models/plugin-manifest.model';
import { PluginLoader } from '../../core/services/plugin-loader';

@Component({
  selector: 'app-plugin-card',
  imports: [],
  templateUrl: './plugin-card.html',
  styleUrl: './plugin-card.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class PluginCard {
  plugin = input.required<PluginManifestEntry>();

  private pluginLoader = inject(PluginLoader);
  private router = inject(Router);

  readonly widgetHost = viewChild<ElementRef<HTMLDivElement>>('widgetHost');
  readonly uiState = signal<'loading' | 'loaded' | 'error'>('loading');

  constructor() {
    // Injecte le Web Component Widget dès que le state passe à 'loaded'
    effect((onCleanup) => {
      const host = this.widgetHost()?.nativeElement;
      if (!host || this.uiState() !== 'loaded' || !this.plugin().widgetElement) {
        return;
      }

      // Création dynamique du tag du widget (ex: <subscription-widget>)
      const widgetEl = document.createElement(this.plugin().widgetElement);
      host.appendChild(widgetEl);

      onCleanup(() => {
        host.replaceChildren();
      });
    });
  }

  ngOnInit() {
    this.loadPlugin();
  }

  async loadPlugin() {
    this.uiState.set('loading');
    try {
      // Ton service charge le script JS et s'assure qu'il n'est pas téléchargé 2 fois
      await this.pluginLoader.loadPluginScript(this.plugin());
      this.uiState.set('loaded');
    } catch (err) {
      this.uiState.set('error');
    }
  }

  navigateToPlugin() {
    if (this.uiState() === 'loaded') {
      this.router.navigate(['/', this.plugin().routePath]);
    }
  }
}
