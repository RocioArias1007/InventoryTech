// ============================================================
// cabecera-panel.component.ts
// Encabezado de los paneles: el logo a la izquierda y el botón de salir a la derecha.
// ============================================================

import { Component, inject } from '@angular/core';
import { AlertController, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { power } from 'ionicons/icons';
import { SesionService } from '../../servicios/sesion.service';

@Component({
  selector: 'app-cabecera-panel',
  standalone: true,
  imports: [IonIcon],
  template: `
    <header class="cabecera">
      <img class="logo" src="assets/logo.png" alt="InventoryTech" />
      <button type="button" class="salir" (click)="salir()" aria-label="Cerrar sesión">
        <ion-icon name="power"></ion-icon>
      </button>
    </header>
  `,
  styles: [`
    .cabecera {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 10px;
    }

    .logo {
      width: 88px;
      height: auto;
    }

    .salir {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      background: none;
      border: 0;
      border-radius: 50%;
      color: var(--it-naranja);
      cursor: pointer;
    }

    .salir ion-icon {
      font-size: 28px;
    }
  `]
})
export class CabeceraPanelComponent {
  private sesion = inject(SesionService);
  private alertas = inject(AlertController);

  constructor() {
    addIcons({ power });
  }

  // Pregunta antes de cerrar la sesión, por si se tocó sin querer.
  async salir(): Promise<void> {
    const alerta = await this.alertas.create({
      header: 'Cerrar sesión',
      message: '¿Quieres salir de InventoryTech?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Salir', role: 'confirm', handler: () => this.sesion.cerrarSesion() }
      ]
    });
    await alerta.present();
  }
}