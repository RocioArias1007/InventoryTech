// ============================================================
// opcion-menu.component.ts
// Tarjeta blanca del menú: un icono arriba y el nombre debajo.
// ============================================================

import { Component, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';

// Datos de una opción del menú. Si no tiene "ruta", la pantalla aún no existe.
export interface OpcionMenu {
  icono: string;
  texto: string;
  colorIcono: string;
  colorTexto: string;
  ruta?: string;
}

@Component({
  selector: 'app-opcion-menu',
  standalone: true,
  imports: [IonIcon],
  template: `
    <button type="button" class="opcion">
      <ion-icon [name]="icono()" [style.color]="colorIcono()"></ion-icon>
      <span [style.color]="colorTexto()">{{ texto() }}</span>
    </button>
  `,
  styles: [`
    :host {
      display: block;
    }

    .opcion {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      min-height: 100px;
      padding: 14px 8px;
      background: var(--it-tarjeta);
      border: 0;
      border-radius: 18px;
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
      font: inherit;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      transition: transform 0.12s ease;
    }

    .opcion:active {
      transform: scale(0.97);
    }

    ion-icon {
      font-size: 30px;
    }

    span {
      font-size: 14px;
      font-weight: 700;
      line-height: 1.2;
      text-align: center;
    }
  `]
})
export class OpcionMenuComponent {
  // Datos que recibe de la pantalla que lo usa.
  icono = input.required<string>();
  texto = input.required<string>();
  colorIcono = input('#64748b');
  colorTexto = input('#14213d');
}