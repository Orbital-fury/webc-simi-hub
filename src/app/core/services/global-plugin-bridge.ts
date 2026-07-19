import { Service, signal } from '@angular/core';

import type { PluginActionDetail } from '../models/plugin-contract.model';

const TOAST_AUTO_DISMISS_MS = 5000;

export interface PluginToast {
  readonly id: number;
  readonly message: string;
  readonly variant: 'info' | 'success' | 'error';
}

export interface PluginModalRequest {
  readonly title: string;
  readonly message: string;
}

/**
 * Point de rencontre unique pour les actions ephemeres qui remontent des
 * plugins (`PLUGIN_ACTION_EVENT`, bubbles + composed) vers des elements
 * d'UI globaux du Hub (toast, modale globale...), independamment du cycle de
 * vie du `PluginContainerComponent` qui a capte l'evenement.
 *
 * NB : webc-simi-ui n'expose pas (encore) de composant "toast" ; ce service
 * ne fait donc pas d'hypothese sur un composant simi-* precis pour l'affichage
 * et se contente d'exposer un etat (signals) que le shell (`AppComponent`)
 * peut rendre avec un minimum de markup, ou avec `<simi-modal>` pour la
 * modale globale.
 */
@Service()
export class GlobalPluginBridge {
  private nextToastId = 0;

  readonly toasts = signal<readonly PluginToast[]>([]);
  readonly modalRequest = signal<PluginModalRequest | null>(null);

  handlePluginAction(detail: PluginActionDetail): void {
    switch (detail.type) {
      case 'toast':
        this.pushToast(detail.payload as { message: string; variant?: PluginToast['variant'] });
        break;
      case 'open-modal':
        this.modalRequest.set(detail.payload as PluginModalRequest);
        break;
      default:
        console.warn(`[GlobalPluginBridge] Action de plugin non geree : "${detail.type}".`);
    }
  }

  dismissToast(id: number): void {
    this.toasts.update((toasts) => toasts.filter((toast) => toast.id !== id));
  }

  closeModal(): void {
    this.modalRequest.set(null);
  }

  private pushToast(payload: { message: string; variant?: PluginToast['variant'] }): void {
    const toast: PluginToast = {
      id: ++this.nextToastId,
      message: payload.message,
      variant: payload.variant ?? 'info',
    };
    this.toasts.update((toasts) => [...toasts, toast]);
    setTimeout(() => this.dismissToast(toast.id), TOAST_AUTO_DISMISS_MS);
  }
}
