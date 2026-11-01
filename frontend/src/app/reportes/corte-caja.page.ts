import { Component, inject, signal } from '@angular/core';
import { IonContent, IonButton, IonIcon, IonSpinner } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { print, download, receiptOutline } from 'ionicons/icons';
import { CabeceraInternaComponent } from '../componentes/cabecera-interna/cabecera-interna.component';
import { ReporteService, RespuestaVentas } from '../servicios/reporte.service';
import { mensajeDeError } from '../utilidades/errores';
import { formatearPesos } from '../utilidades/formato';
import { descargarCsv, imprimir } from '../utilidades/exportar';

@Component({
  selector: 'app-corte-caja',
  standalone: true,
  imports: [IonContent, IonButton, IonIcon, IonSpinner, CabeceraInternaComponent],
  templateUrl: './corte-caja.page.html',
  styleUrls: ['./corte-caja.page.scss'],
})
export class CorteCajaPage {
  private servicio = inject(ReporteService);

  datos = signal<RespuestaVentas | null>(null);
  cargando = signal(true);
  error = signal('');

  pesos = formatearPesos;

  constructor() {
    addIcons({ print, download, receiptOutline });
  }

  ionViewWillEnter() {
    this.cargar();
  }

  cargar() {
    this.cargando.set(true);
    this.error.set('');
    this.servicio.ventasDeHoy().subscribe({
      next: (r) => {
        this.datos.set(r);
        this.cargando.set(false);
      },
      error: (e) => {
        this.error.set(mensajeDeError(e));
        this.cargando.set(false);
      },
    });
  }

  hora(fecha: string): string {
    return new Date(fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  }

  imprimir() {
    imprimir();
  }

  exportar() {
    const d = this.datos();
    if (!d) return;
    descargarCsv(
      `corte-caja-${d.desde}`,
      ['Venta', 'Hora', 'Vendedor', 'Unidades', 'Total'],
      d.ventas.map((v) => [v.id_venta, this.hora(v.fecha_venta), v.vendedor, v.unidades, v.total])
    );
  }
}