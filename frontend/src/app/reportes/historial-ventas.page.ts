import { Component, inject, signal } from '@angular/core';
import { IonContent, IonButton, IonIcon, IonSpinner } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { print, download, receiptOutline } from 'ionicons/icons';
import { CabeceraInternaComponent } from '../componentes/cabecera-interna/cabecera-interna.component';
import { FiltroFechasComponent } from '../componentes/filtro-fechas/filtro-fechas.component';
import { ReporteService, RespuestaVentas } from '../servicios/reporte.service';
import { mensajeDeError } from '../utilidades/errores';
import { formatearPesos, fechaHora } from '../utilidades/formato';
import { descargarCsv, imprimir } from '../utilidades/exportar';

@Component({
  selector: 'app-historial-ventas',
  standalone: true,
  imports: [IonContent, IonButton, IonIcon, IonSpinner, CabeceraInternaComponent, FiltroFechasComponent],
  templateUrl: './historial-ventas.page.html',
  styleUrls: ['./reportes-comunes.scss'],
})
export class HistorialVentasPage {
  private servicio = inject(ReporteService);

  datos = signal<RespuestaVentas | null>(null);
  cargando = signal(false);
  error = signal('');

  pesos = formatearPesos;
  fechaHora = fechaHora;
  private rango: { desde: string; hasta: string } | null = null;
  private numeroPeticion = 0;

  constructor() {
    addIcons({ print, download, receiptOutline });
  }

  ionViewWillEnter() {
    if (this.rango) this.cargar();
  }

  alBuscar(r: { desde: string; hasta: string }) {
    this.rango = r;
    this.cargar();
  }

  cargar() {
    if (!this.rango) return;
    const numero = ++this.numeroPeticion;
    this.cargando.set(true);
    this.error.set('');
    this.servicio.ventasPorRango(this.rango.desde, this.rango.hasta).subscribe({
      next: (r) => {
        if (numero !== this.numeroPeticion) return;
        this.datos.set(r);
        this.cargando.set(false);
      },
      error: (e) => {
        if (numero !== this.numeroPeticion) return;
        this.datos.set(null);
        this.error.set(mensajeDeError(e));
        this.cargando.set(false);
      },
    });
  }

  imprimir() {
    imprimir();
  }

  exportar() {
    const d = this.datos();
    if (!d) return;
    descargarCsv(
      `historial-ventas-${d.desde}-a-${d.hasta}`,
      ['Venta', 'Fecha', 'Vendedor', 'Unidades', 'Total'],
      d.ventas.map((v) => [v.id_venta, fechaHora(v.fecha_venta), v.vendedor, v.unidades, v.total])
    );
  }
}