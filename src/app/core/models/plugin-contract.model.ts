import type { PluginScopedStorage } from '../db/hub-database';

/** Emis par le plugin pour demander une navigation (mise a jour de l'URL Angular). */
export const PLUGIN_NAVIGATE_EVENT = 'plugin-navigate';

/** Emis par le plugin pour declencher une action ephemere globale (toast, modale...). */
export const PLUGIN_ACTION_EVENT = 'plugin-action';

export interface PluginNavigateDetail {
  /** Chemin relatif souhaite a l'interieur du plugin (sans le `routePath`). */
  readonly path: string;
}

export interface PluginActionDetail {
  readonly type: string;
  readonly payload?: unknown;
}

/**
 * Contrat minimal attendu cote Hub pour tout Custom Element de plugin :
 * - proprietes transmises par le `PluginContainerComponent` (`subRoute`,
 *   `assetBaseUrl`, `storage`) ;
 * - evenements natifs (`bubbles: true, composed: true`) que le plugin peut
 *   emettre pour dialoguer avec le Hub (`PLUGIN_NAVIGATE_EVENT`,
 *   `PLUGIN_ACTION_EVENT`).
 * Le plugin reste seul responsable de son propre cycle de vie
 * (`disconnectedCallback` : nettoyage de ses listeners globaux, timers, etc.).
 */
export interface PluginHostElement extends HTMLElement {
  subRoute: string;
  assetBaseUrl: string;
  storage?: PluginScopedStorage;
}
