/**
 * Une entree du manifeste des plugins (`public/assets/manifest.json`).
 * Contrat de securite : `requiredRoles` est verifie avant chargement, et
 * `integrity` (SRI) + `crossOrigin` sont appliques a l'injection du script.
 */
export interface PluginManifestEntry {
  readonly id: string;
  /** Libelle affiche dans la navigation du Hub (repli sur `id` si absent). */
  readonly label?: string;
  readonly routePath: string;
  readonly entrypoint: string;
  readonly devPort: string;
  readonly widgetElement: string;
  readonly pageElement: string;
  readonly requiredRoles: readonly string[];
  readonly integrity: string;
  readonly assetBaseUrl: string;
}

export interface PluginManifest {
  readonly plugins: readonly PluginManifestEntry[];
}
