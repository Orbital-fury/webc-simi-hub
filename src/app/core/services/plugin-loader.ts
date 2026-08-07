import { effect, inject, isDevMode, resource, Service, type Resource } from '@angular/core';

import { HubDatabase } from '../db/hub-database';
import { PluginLoaderError } from '../errors/plugin-loader-error';
import type { PluginManifest, PluginManifestEntry } from '../models/plugin-manifest.model';
import { Auth } from './auth';

const MANIFEST_URL = 'assets/manifest.json';
const ELEMENT_DEFINITION_TIMEOUT_MS = 8000;

/**
 * Pilote le manifeste des plugins (Resource API) et l'injection securisee
 * (SRI + validation de roles) de leurs scripts en Custom Elements.
 */
@Service()
export class PluginLoader {
  private readonly auth = inject(Auth);
  private readonly hubDatabase = inject(HubDatabase);

  /** Elements deja definis (script charge + `customElements.whenDefined` resolu). */
  private readonly loadedElements = new Set<string>();
  /** Deduplique les chargements de script concurrents pour un meme entrypoint. */
  private readonly pendingScripts = new Map<string, Promise<void>>();

  readonly manifestResource: Resource<PluginManifest> = resource({
    defaultValue: { plugins: [] },
    loader: async ({ abortSignal }) => {
      const response = await fetch(MANIFEST_URL, { signal: abortSignal });
      if (!response.ok) {
        throw new PluginLoaderError(
          'manifest-unavailable',
          `Impossible de charger le manifeste des plugins (HTTP ${response.status}).`,
        );
      }
      const manifest = (await response.json()) as PluginManifest;

      // En dev local, on crée une copie du manifeste avec les URLs réécrites
      if (isDevMode()) {
        return {
          ...manifest,
          plugins: manifest.plugins.map((plugin) => ({
            ...plugin,
            entrypoint: `${plugin.devPort}/main.js`,
            assetBaseUrl: `${plugin.devPort}/`,
          })),
        };
      }

      return manifest;
    },
  });

  constructor() {
    // Des que le manifeste est reellement resolu (pas la `defaultValue`
    // synchrone `{ plugins: [] }` renvoyee par la Resource API le temps du
    // fetch), declare une table cloisonnee par plugin cote Dexie. Se fier a
    // `status() === 'resolved'` plutot qu'a la simple presence de
    // `.value()` : `HubDatabase.registerPluginStores` ne s'execute qu'une
    // seule fois (`verno > 0` guard), donc un premier appel premature avec
    // une liste vide figerait un schema Dexie sans aucune table plugin.
    effect(() => {
      if (this.manifestResource.status() !== 'resolved') {
        return;
      }
      const manifest = this.manifestResource.value();
      this.hubDatabase.registerPluginStores(manifest.plugins.map((plugin) => plugin.id));
    });
  }

  /**
   * Resout une entree du manifeste pour un segment de route donne, valide
   * les roles requis, puis charge (ou reutilise) le script du plugin avec SRI.
   */
  async resolvePlugin(
    manifest: PluginManifest,
    routeSegment: string,
    abortSignal?: AbortSignal,
  ): Promise<PluginManifestEntry> {
    const entry = manifest.plugins.find((plugin) => plugin.routePath === routeSegment);
    if (!entry) {
      throw new PluginLoaderError(
        'not-found',
        `Aucun plugin ne correspond au chemin "${routeSegment}".`,
      );
    }
    if (!this.auth.hasAnyRole(entry.requiredRoles)) {
      throw new PluginLoaderError(
        'forbidden',
        `Vous n'avez pas les droits requis pour acceder au plugin "${entry.id}".`,
      );
    }
    await this.loadPluginScript(entry, abortSignal);
    return entry;
  }

  loadPluginScript(entry: PluginManifestEntry, abortSignal?: AbortSignal): Promise<void> {
    if (this.loadedElements.has(entry.pageElement)) {
      return Promise.resolve();
    }
    if (abortSignal?.aborted) {
      return Promise.reject(new DOMException('Chargement annule.', 'AbortError'));
    }

    const pending = this.pendingScripts.get(entry.entrypoint);
    if (pending) {
      return pending;
    }

    const promise = this.injectScript(entry)
      .then(() => this.waitForElementDefinition(entry))
      .then(() => {
        this.loadedElements.add(entry.pageElement);
      })
      .finally(() => {
        this.pendingScripts.delete(entry.entrypoint);
      });

    this.pendingScripts.set(entry.entrypoint, promise);
    return promise;
  }

  private injectScript(entry: PluginManifestEntry): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const existingScripts = document.querySelectorAll<HTMLScriptElement>(
        `script[data-plugin-id="${entry.id}"]`,
      );
      existingScripts.forEach((s) => s.remove());

      const shouldCheckSRI = !isDevMode() && !!entry.integrity;
      const scriptUrl = isDevMode() ? `${entry.entrypoint}?t=${Date.now()}` : entry.entrypoint;

      const script = document.createElement('script');
      script.type = 'module';
      script.src = scriptUrl;
      script.setAttribute('data-plugin-id', entry.id);
      // Securite : verifie l'integrite du script (SRI) et bloque l'envoi de
      // credentials/cookies cross-origin avant toute execution.
      if (shouldCheckSRI) {
        script.integrity = entry.integrity;
        script.crossOrigin = 'anonymous';
        script.referrerPolicy = 'no-referrer';
      }

      script.addEventListener('load', () => resolve(), { once: true });
      script.addEventListener(
        'error',
        () => {
          script.remove();

          reject(
            new PluginLoaderError(
              'script-error',
              `Echec du chargement du script du plugin "${entry.id}" (reseau, CORS, 404 ou integrite SRI invalide).`,
            ),
          );
        },
        { once: true },
      );
      document.head.appendChild(script);
    });
  }

  private waitForElementDefinition(entry: PluginManifestEntry): Promise<void> {
    const elementsToWait = [entry.pageElement];
    if (entry.widgetElement) {
      elementsToWait.push(entry.widgetElement);
    }

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new PluginLoaderError(
            'definition-timeout',
            `Le plugin "${entry.id}" n'a pas défini ses éléments (${elementsToWait.join(', ')}) à temps.`,
          ),
        );
      }, ELEMENT_DEFINITION_TIMEOUT_MS);

      Promise.all(elementsToWait.map((el) => customElements.whenDefined(el)))
        .then(() => {
          clearTimeout(timer); // Nettoyage du timer en cas de succès
          resolve();
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }
}
