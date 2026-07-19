import {
  CUSTOM_ELEMENTS_SCHEMA,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  resource,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { HubDatabase } from '../../core/db/hub-database';
import {
  PLUGIN_ACTION_EVENT,
  PLUGIN_NAVIGATE_EVENT,
  type PluginActionDetail,
  type PluginHostElement,
  type PluginNavigateDetail,
} from '../../core/models/plugin-contract.model';
import type { PluginManifestEntry } from '../../core/models/plugin-manifest.model';
import { GlobalPluginBridge } from '../../core/services/global-plugin-bridge';
import { PluginLoader } from '../../core/services/plugin-loader';
import { PluginCard } from '../plugin-card/plugin-card';

type PluginUiState = 'idle' | 'loading' | 'error' | 'loaded';

/**
 * Deep-linking par wildcard : le premier segment de l'URL identifie le
 * plugin (`routePath` du manifeste), le reste devient sa `subRoute`. Le
 * chargement (manifeste -> role -> script SRI -> definition du Custom
 * Element) est entierement pilote par la Resource API et restitue via
 * `@switch` (idle / loading / error / loaded). Une fois charge, le plugin
 * est monte imperativement dans le DOM et recoit `subRoute`/`assetBaseUrl`/
 * `storage`, et ses evenements `plugin-navigate` / `plugin-action` sont
 * ecoutes puis relayes (Router / GlobalPluginBridge).
 */
@Component({
  selector: 'app-plugin-container',
  imports: [PluginCard],
  templateUrl: './plugin-container.html',
  styleUrl: './plugin-container.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class PluginContainer {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly pluginLoader = inject(PluginLoader);
  private readonly bridge = inject(GlobalPluginBridge);
  private readonly hubDatabase = inject(HubDatabase);

  private readonly pluginHost = viewChild<ElementRef<HTMLDivElement>>('pluginHost');
  private activeElement: PluginHostElement | null = null;

  /** Liste des plugins du manifeste, pour la navigation du Hub. */
  protected readonly plugins = computed(() => this.pluginLoader.manifestResource.value().plugins);

  private readonly urlSegments = toSignal(this.route.url, {
    initialValue: this.route.snapshot.url,
  });

  /** Premier segment de l'URL courante = identifiant de route du plugin. */
  protected readonly pluginId = computed(() => this.urlSegments()[0]?.path ?? '');

  /** Reste du chemin, transmis tel quel au Custom Element via `subRoute`. */
  protected readonly subRoute = computed(() =>
    this.urlSegments()
      .slice(1)
      .map((segment) => segment.path)
      .join('/'),
  );

  /**
   * Chaine son `params` sur le manifeste (propage automatiquement les
   * statuts `loading`/`error` du manifeste), puis resout et charge le
   * plugin correspondant au segment de route courant.
   */
  protected readonly pluginState = resource({
    params: (ctx) => {
      const manifest = ctx.chain(this.pluginLoader.manifestResource);
      const routeSegment = this.pluginId();
      return routeSegment ? { manifest, routeSegment } : undefined;
    },
    loader: ({ params, abortSignal }) =>
      this.pluginLoader.resolvePlugin(params.manifest, params.routeSegment, abortSignal),
  });

  protected readonly uiState = computed<PluginUiState>(() => {
    switch (this.pluginState.status()) {
      case 'idle':
        return 'idle';
      case 'error':
        return 'error';
      case 'resolved':
      case 'local':
        return 'loaded';
      default:
        return 'loading';
    }
  });

  protected readonly errorMessage = computed(
    () => this.pluginState.error()?.message ?? 'Une erreur inattendue est survenue.',
  );

  constructor() {
    // Monte/demonte le Custom Element du plugin quand le conteneur hote
    // (re)apparait dans le DOM (entree/sortie du `@case ('loaded')`).
    effect((onCleanup) => {
      const host = this.pluginHost()?.nativeElement;
      const entry = untracked(() => this.pluginState.value());
      if (!host || !entry) {
        return;
      }

      const element = this.mountPluginElement(host, entry);

      onCleanup(() => {
        element.removeEventListener(PLUGIN_NAVIGATE_EVENT, this.onPluginNavigate as EventListener);
        element.removeEventListener(PLUGIN_ACTION_EVENT, this.onPluginAction as EventListener);
        host.replaceChildren();
        this.activeElement = null;
      });
    });

    // Propage les changements de sous-route au plugin deja monte, sans le
    // recreer (seul un changement de plugin doit remonter un nouvel element).
    effect(() => {
      const subRoute = this.subRoute();
      if (this.activeElement) {
        this.activeElement.subRoute = subRoute;
      }
    });
  }

  protected retry(): void {
    this.pluginState.reload();
  }

  private mountPluginElement(host: HTMLDivElement, entry: PluginManifestEntry): PluginHostElement {
    const element = document.createElement(entry.pageElement) as PluginHostElement;
    element.subRoute = untracked(() => this.subRoute());
    element.assetBaseUrl = entry.assetBaseUrl;
    element.storage = this.hubDatabase.scopedStorage(entry.id);

    element.addEventListener(PLUGIN_NAVIGATE_EVENT, this.onPluginNavigate as EventListener);
    element.addEventListener(PLUGIN_ACTION_EVENT, this.onPluginAction as EventListener);

    host.replaceChildren(element);
    this.activeElement = element;
    return element;
  }

  /** Le plugin pilote sa propre sous-navigation ; le Hub reste seul maitre de l'URL Angular. */
  private readonly onPluginNavigate = (event: CustomEvent<PluginNavigateDetail>): void => {
    const entry = this.pluginState.value();
    if (!entry) {
      return;
    }
    const target = `/${entry.routePath}/${event.detail.path}`.replace(/\/+$/, '');
    void this.router.navigateByUrl(target || `/${entry.routePath}`);
  };

  /** Action ephemere (toast, modale globale...) relayee au bridge partage. */
  private readonly onPluginAction = (event: CustomEvent<PluginActionDetail>): void => {
    this.bridge.handlePluginAction(event.detail);
  };
}
