import { Component, inject, signal } from '@angular/core';
import { IonContent, IonButton, IonIcon, IonSpinner } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { print, download, trendingUp } from 'ionicons/icons';
import { CabeceraInternaComponent } from '../componentes/cabecera-interna/cabecera-interna.component';
import { FiltroFechasComponent } from '../componentes/filtro-fechas/filtro-fechas.component';
import { ReporteService, RespuestaRentabilidad } from '../servicios/reporte.service';
import { mensajeDeError } from '../utilidades/errores';
import { formatearPesos } from '../utilidades/formato';
import { descargarCsv, imprimir } from '../utilidades/exportar';

@Component({
  selector: 'app-rentabilidad',
  standalone: true,
  imports: [IonContent, IonButton, IonIcon, IonSpinner, CabeceraInternaComponent, FiltroFechasComponent],
  templateUrl: './rentabilidad.page.html',
  styleUrls: ['./reportes-comunes.scss'],
})
export class RentabilidadPage {
  private servicio = inject(ReporteService);

  datos = signal<RespuestaRentabilidad | null>(null);
  cargando = signal(false);
  error = signal('');

  pesos = formatearPesos;
  private rango: { desde: string; hasta: string } | null = null;
  private numeroPeticion = 0;

  constructor() {
    addIcons({ print, download, trendingUp });
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
    this.servicio.rentabilidad(this.rango.desde, this.rango.hasta).subscribe({
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

  margen(valor: number | null): string {
    return valor === null ? '-' : `${valor}%`;
  }

    imprimir() {
    const d = this.datos();
    if (!d) return;
    const vendido = d.productos.reduce((suma, p) => suma + p.ingresos, 0);
    const costo = d.productos.reduce((suma, p) => suma + p.costo, 0);
    const ganancia = d.productos.reduce((suma, p) => suma + p.ganancia, 0);

    imprimir({
      titulo: 'Rentabilidad',
      subtitulo: `Del ${d.desde} al ${d.hasta}`,
      columnas: ['Producto', 'Unidades', 'Vendido', 'IVA', 'Vendido sin IVA', 'Costo', 'Ganancia', 'Margen'],
      filas: d.productos.map((p) => [
        p.nombre,
        p.unidades,
        this.pesos(p.ingresos),
        this.pesos(p.iva),
        this.pesos(p.ingresos_sin_iva),
        this.pesos(p.costo),
        this.pesos(p.ganancia),
        this.margen(p.margen_porcentaje),
      ]),
      resumen: [
        { etiqueta: 'Total vendido', valor: this.pesos(vendido) },
        { etiqueta: 'Costo total', valor: this.pesos(costo) },
        { etiqueta: 'Ganancia total', valor: this.pesos(ganancia) },
      ],
    });
  }

    exportar() {
    const d = this.datos();
    if (!d) return;
    descargarCsv(
      `rentabilidad-${d.desde}-a-${d.hasta}`,
      ['Producto', 'Unidades', 'Vendido', 'IVA', 'Vendido sin IVA', 'Costo', 'Ganancia', 'Margen %'],
      d.productos.map((p) => [
        p.nombre, p.unidades, p.ingresos, p.iva, p.ingresos_sin_iva, p.costo, p.ganancia,
        p.margen_porcentaje ?? '',
      ])
    );
  }
}