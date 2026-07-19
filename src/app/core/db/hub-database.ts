import { Service } from '@angular/core';
import Dexie, { Table } from 'dexie';

export interface PluginRecord {
  readonly key: string;
  readonly value: unknown;
  readonly updatedAt: number;
}

/** Nom de table cloisonne et prefixe par plugin, ex. `plugin_subscription_data`. */
export function pluginTableName(pluginId: string): string {
  return `plugin_${pluginId}_data`;
}

/**
 * Facade exposee a un plugin donne : ne permet d'acceder qu'a sa propre table
 * (aucune fuite/collision possible avec les donnees d'un autre plugin).
 */
export class PluginScopedStorage {
  constructor(
    private readonly database: HubDatabase,
    private readonly pluginId: string,
  ) {}

  async get<T>(key: string): Promise<T | undefined> {
    const record = await this.database.tableFor(this.pluginId).get(key);
    return record?.value as T | undefined;
  }

  async set<T>(key: string, value: T): Promise<void> {
    const newValue =
      value !== null && typeof value === 'object' ? JSON.parse(JSON.stringify(value)) : value;
    await this.database
      .tableFor(this.pluginId)
      .put({ key, value: newValue, updatedAt: Date.now() });
  }

  async remove(key: string): Promise<void> {
    await this.database.tableFor(this.pluginId).delete(key);
  }

  async clear(): Promise<void> {
    await this.database.tableFor(this.pluginId).clear();
  }
}

/**
 * Base IndexedDB (Dexie) du Hub. Une table cloisonnee et prefixee est
 * declaree par plugin connu du manifeste (`plugin_<id>_data`) afin d'isoler
 * completement leurs donnees respectives.
 */
@Service()
export class HubDatabase extends Dexie {
  constructor() {
    super('webc-simi-hub');
  }

  /**
   * Declare le schema (une table par plugin) a partir des ids du manifeste.
   * A appeler une seule fois, des que le manifeste est resolu et avant toute
   * ouverture effective de la base (ajout de version Dexie).
   */
  registerPluginStores(pluginIds: readonly string[]): void {
    if (this.verno > 0) {
      return;
    }
    const stores = Object.fromEntries(
      pluginIds.map((id) => [pluginTableName(id), '&key, updatedAt']),
    );
    this.version(1).stores(stores);
  }

  tableFor(pluginId: string): Table<PluginRecord, string> {
    const name = pluginTableName(pluginId);
    if (!this.tables.some((table) => table.name === name)) {
      throw new Error(
        `Le plugin "${pluginId}" n'est pas enregistre dans le schema de la base du Hub.`,
      );
    }
    return this.table<PluginRecord, string>(name);
  }

  /** Point d'entree expose aux plugins pour un stockage cloisonne (Dexie/IndexedDB). */
  scopedStorage(pluginId: string): PluginScopedStorage {
    return new PluginScopedStorage(this, pluginId);
  }
}
