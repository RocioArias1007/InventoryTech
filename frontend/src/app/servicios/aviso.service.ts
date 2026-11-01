// ============================================================
// aviso.service.ts
// Muestra avisos cortos (toast) que desaparecen solos.
// Lo usarán todas las pantallas.
// ============================================================

import { Injectable, inject } from '@angular/core';
import { ToastController } from '@ionic/angular';

@Injectable({ providedIn: 'root' })
export class AvisoService {
  private toast = inject(ToastController);

  async mostrar(mensaje: string, color: 'dark' | 'success' | 'danger' | 'warning' = 'dark'): Promise<void> {
    const aviso = await this.toast.create({
      message: mensaje,
      duration: 2500,
      position: 'bottom',
      color
    });
    await aviso.present();
  }
}