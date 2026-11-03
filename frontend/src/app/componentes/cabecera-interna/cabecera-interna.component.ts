// ============================================================
// cabecera-interna.component.ts
// Encabezado de las pantallas internas: flecha de volver, título y,
// a la derecha, un hueco para un botón (por ejemplo el "+").
// ============================================================

import { Component, inject, input } from '@angular/core';
import { IonIcon, NavController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowUndo } from 'ionicons/icons';

@Component({
  selector: 'app-cabecera-interna',
  standalone: true,
  imports: [IonIcon],
  template: `
    <header class="cabecera">
      <button type="button" class="volver" (click)="volver()" aria-label="Volver">
        <ion-icon name="arrow-undo"></ion-icon>
      </button>
      <h1>{{ titulo() }}</h1>
      <div class="accion">
        <!-- Aquí cada pantalla puede poner su botón (por ejemplo el "+"). -->
        <ng-content select="[accion]"></ng-content>
      </div>
    </header>
  `,
  styles: [`
    .cabecera {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 56px;
  padding-top: calc(6px + env(safe-area-inset-top, 0px));
}

    .volver {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      margin-left: -6px;
      background: none;
      border: 0;
      color: var(--it-turquesa);
      cursor: pointer;
    }

    .volver ion-icon {
      font-size: 26px;
    }

    h1 {
      flex: 1;
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      line-height: 1.2;
      color: var(--it-texto-claro);
    }

    .accion {
      display: flex;
      align-items: center;
    }
  `]
})
export class CabeceraInternaComponent {
  // Datos que recibe de la pantalla que lo usa.
  titulo = input.required<string>();
  volverA = input.required<string>();

  private nav = inject(NavController);

  constructor() {
    addIcons({ arrowUndo });
  }

  // Vuelve a la pantalla indicada, con la animación de "regresar".
  volver(): void {
    this.nav.navigateBack(this.volverA());
  }
}