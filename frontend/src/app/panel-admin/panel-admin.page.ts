// ============================================================
// panel-admin.page.ts
// Panel del administrador: resumen del día y menú administrativo.
// ============================================================

import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonFab, IonFabButton, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { barChart, cart, chatbubble, cube, list, people, time } from 'ionicons/icons';
import { CabeceraPanelComponent } from '../componentes/cabecera-panel/cabecera-panel.component';
import { OpcionMenu, OpcionMenuComponent } from '../componentes/opcion-menu/opcion-menu.component';
import { AvisoService } from '../servicios/aviso.service';
import { ReporteService, ResumenPanel } from '../servicios/reporte.service';
import { SesionService } from '../servicios/sesion.service';
import { formatearPesos } from '../utilidades/formato';

@Component({
  selector: 'app-panel-admin',
  templateUrl: 'panel-admin.page.html',
  styleUrls: ['panel-admin.page.scss'],
  imports: [IonContent, IonFab, IonFabButton, IonIcon, CabeceraPanelComponent, OpcionMenuComponent],
  standalone: true,
})
export class PanelAdminPage {
  private router = inject(Router);
  private aviso = inject(AvisoService);
  private reportes = inject(ReporteService);

  // Nombre de quien inició sesión, para el saludo.
  nombre = inject(SesionService).usuario?.nombre ?? '';

  // Datos del resumen y estado de la carga.
  resumen = signal<ResumenPanel | null>(null);
  errorResumen = signal(false);

  // Texto de la tarjeta "Stock Bajo".
  textoStock = computed(() => {
    const datos = this.resumen();
    if (!datos) return this.errorResumen() ? '—' : '…';
    const total = datos.stock_bajo.total;
    if (total === 0) return 'Sin productos críticos';
    return total === 1 ? '1 producto crítico' : `${total} productos críticos`;
  });

  // Texto de la tarjeta "Ventas Hoy".
  textoVentas = computed(() => {
    const datos = this.resumen();
    if (!datos) return this.errorResumen() ? '—' : '…';
    return formatearPesos(datos.ventas_hoy.total_ingresos);
  });

  // Tarjetas del menú. Cuando se construya cada pantalla, se le agrega su "ruta".
  // Los colores de los iconos y los textos están estimados del mockup.
  opciones: OpcionMenu[] = [
    { icono: 'cube', texto: 'Productos', colorIcono: '#64748b', colorTexto: '#14213d', ruta: '/productos'  },
    { icono: 'people', texto: 'Usuarios', colorIcono: '#93c5fd', colorTexto: '#1d4ed8', ruta: '/usuarios' },
    { icono: 'cart', texto: 'Ventas', colorIcono: '#34d399', colorTexto: '#047857', ruta: '/ventas' },
    { icono: 'time', texto: 'Ventas por Período', colorIcono: '#a5b4fc', colorTexto: '#4338ca', ruta: '/ventas-periodo' },
    { icono: 'list', texto: 'Categorías', colorIcono: '#fdba74', colorTexto: '#b45309', ruta: '/categorias' },
    { icono: 'bar-chart', texto: 'Reportes', colorIcono: '#2dd4bf', colorTexto: '#0f766e', ruta: '/reportes' },
  ];

  constructor() {
    // Registra los iconos que usa esta pantalla.
    addIcons({ barChart, cart, chatbubble, cube, list, people, time });
  }

  // Ionic llama a esto cada vez que se entra a la pantalla: así los números siempre están al día.
  ionViewWillEnter(): void {
    this.cargarResumen();
  }

  // Pide al backend "Stock Bajo" y "Ventas Hoy".
  async cargarResumen(): Promise<void> {
    this.errorResumen.set(false);
    try {
      this.resumen.set(await this.reportes.resumenPanel());
    } catch {
      // Si la sesión venció, el interceptor ya lleva al login. Cualquier otro fallo se avisa aquí.
      this.errorResumen.set(true);
    }
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