export type PluginLoaderErrorKind =
  'manifest-unavailable' | 'not-found' | 'forbidden' | 'script-error' | 'definition-timeout';

/**
 * Erreur typee levee par le `PluginLoader`. Le `kind` permet au
 * `PluginContainerComponent` d'adapter le message de secours affiche a
 * l'utilisateur (manifeste indisponible, plugin inconnu, role manquant,
 * echec reseau/CORS/SRI, ou plugin qui ne s'est jamais defini).
 */
export class PluginLoaderError extends Error {
  constructor(
    readonly kind: PluginLoaderErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'PluginLoaderError';
  }
}
