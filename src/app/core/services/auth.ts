import { Service, signal } from '@angular/core';

/**
 * Source des roles de l'utilisateur courant, consommee par le `PluginLoader`
 * pour valider les `requiredRoles` du manifeste avant chargement d'un plugin.
 *
 * Placeholder : les roles sont geres localement via un signal en attendant
 * l'integration du systeme d'authentification reel du Hub (ex. OIDC/JWT).
 */
@Service()
export class Auth {
  private readonly currentRoles = signal<readonly string[]>(['user']);

  readonly roles = this.currentRoles.asReadonly();

  hasAnyRole(requiredRoles: readonly string[]): boolean {
    if (requiredRoles.length === 0) {
      return true;
    }
    const roles = this.currentRoles();
    return requiredRoles.some((role) => roles.includes(role));
  }

  setRoles(roles: readonly string[]): void {
    this.currentRoles.set(roles);
  }
}
