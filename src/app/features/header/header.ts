import { Component, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';

@Component({
  selector: 'app-header',
  imports: [],
  templateUrl: './header.html',
  styleUrl: './header.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class HeaderComponent {
  protected readonly router = inject(Router);

  public isRoot = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects.split('?')[0] === '/'),
    ),
    { initialValue: this.router.url.split('?')[0] === '/' },
  );

  returnToHub() {
    this.router.navigate(['/']);
  }
}
