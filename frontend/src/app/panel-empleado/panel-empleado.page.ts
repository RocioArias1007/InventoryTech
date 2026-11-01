// ============================================================
// panel-empleado.page.ts
// Panel del empleado: registrar ventas y consultar existencias.
// ============================================================

import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonFab, IonFabButton, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { cart, chatbubble, search } from 'ionicons/icons';
import { CabeceraPanelComponent } from '../componentes/cabecera-panel/cabecera-panel.component';
import { OpcionMenu, OpcionMenuComponent } from '../componentes/opcion-menu/opcion-menu.component';
import { AvisoService } from '../servicios/aviso.service';
import { SesionService } from '../servicios/sesion.service';

@Component({
  selector: 'app-panel-empleado',
  templateUrl: 'panel-empleado.page.html',
  imports: [IonContent, IonFab, IonFabButton, IonIcon, CabeceraPanelComponent, OpcionMenuComponent],
  standalone: true,
})
export class PanelEmpleadoPage {
  private router = inject(Router);
  private aviso = inject(AvisoService);

  // Nombre de quien inició sesión, para el saludo.
  nombre = inject(SesionService).usuario?.nombre ?? '';

  // Tarjetas del menú. Cuando se construya cada pantalla, se le agrega su "ruta".
  opciones: OpcionMenu[] = [
    { icono: 'cart', texto: 'Realizar Venta', colorIcono: '#34d399', colorTexto: '#047857', ruta: '/empleado/ventas' },
    { icono: 'search', texto: 'Consultar Stock', colorIcono: '#64748b', colorTexto: '#14213d', ruta: '/empleado/stock' },
  ];

  constructor() {
    // Registra los iconos que usa esta pantalla.
    addIcons({ cart, chatbubble, search });
  }

  // Abre la pantalla de una tarjeta, o avisa que todavía no existe.
  abrir(opcion: OpcionMenu): void {
    if (!opcion.ruta) {
      this.aviso.mostrar('Esta pantalla se construye en los próximos pasos.');
      return;
    }
    this.router.navigateByUrl(opcion.ruta);
  }

  // El chat con Katia 
    abrirChat(): void {
    this.router.navigateByUrl('/chat');
  }
}