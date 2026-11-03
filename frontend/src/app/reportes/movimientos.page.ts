import { Component, inject, signal } from '@angular/core';
import { IonContent, IonButton, IonIcon, IonSpinner } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { print, download, swapVertical } from 'ionicons/icons';
import { CabeceraInternaComponent } from '../componentes/cabecera-interna/cabecera-interna.component';
import { FiltroFechasComponent } from '../componentes/filtro-fechas/filtro-fechas.component';
import { ReporteService, RespuestaMovimientos, Movimiento } from '../servicios/reporte.service';
import { mensajeDeError } from '../utilidades/errores';
import { fechaHora } from '../utilidades/formato';
import { descargarCsv, imprimir } from '../utilidades/exportar';

@Component({
  selector: 'app-movimientos',
  standalone: true,
  imports: [IonContent, IonButton, IonIcon, IonSpinner, CabeceraInternaComponent, FiltroFechasComponent],
  templateUrl: './movimientos.page.html',
  styleUrls: ['./reportes-comunes.scss'],
})
export class MovimientosPage {
  private servicio = inject(ReporteService);

  datos = signal<RespuestaMovimientos | null>(null);
  cargando = signal(false);
  error = signal('');
  tipo = signal('');

  tipos = [
    { valor: '', texto: 'Todos' },
    { valor: 'ingreso', texto: 'Ingresos' },
    { valor: 'venta', texto: 'Ventas' },
  ];

  fechaHora = fechaHora;
  private rango: { desde: string; hasta: string } | null = null;
  private numeroPeticion = 0;

  constructor() {
    addIcons({ print, download, swapVertical });
  }

  ionViewWillEnter() {
    if (this.rango) this.cargar();
  }

  alBuscar(r: { desde: string; hasta: string }) {
    this.rango = r;
    this.cargar();
  }

  elegirTipo(valor: string) {
    this.tipo.set(valor);
    if (this.rango) this.cargar();
  }

  cargar() {
    if (!this.rango) return;
    const numero = ++this.numeroPeticion;
    this.cargando.set(true);
    this.error.set('');
    this.servicio.movimientos(this.rango.desde, this.rango.hasta, this.tipo()).subscribe({
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

  cambio(m: Movimiento): number {
    return m.stock_nuevo - m.stock_anterior;
  }

  nombreTipo(t: string): string {
    return t === 'ingreso' ? 'Ingreso' : t === 'venta' ? 'Venta' : 'Ajuste';
  }

    imprimir() {
    const d = this.datos();
    if (!d) return;
    const ingresos = d.movimientos.filter((m) => m.tipo === 'ingreso').length;
    const ventas = d.movimientos.filter((m) => m.tipo === 'venta').length;
    const filtro = this.tipos.find((t) => t.valor === this.tipo())?.texto ?? 'Todos';

    imprimir({
      titulo: 'Movimientos de inventario',
      subtitulo: `Del ${d.desde} al ${d.hasta} (${filtro})`,
      columnas: ['Fecha', 'Producto', 'Tipo', 'Cantidad', 'Stock anterior', 'Stock nuevo', 'Usuario'],
      filas: d.movimientos.map((m) => [
        fechaHora(m.fecha), m.producto, this.nombreTipo(m.tipo), m.cantidad,
        m.stock_anterior, m.stock_nuevo, m.usuario,
      ]),
      resumen: [
        { etiqueta: 'Movimientos', valor: d.movimientos.length },
        { etiqueta: 'Ingresos', valor: ingresos },
        { etiqueta: 'Ventas', valor: ventas },
      ],
    });
  }

    exportar() {
    const d = this.datos();
    if (!d) return;
    descargarCsv(
      `movimientos-${d.desde}-a-${d.hasta}`,
      ['Fecha', 'Producto', 'Tipo', 'Cantidad', 'Stock anterior', 'Stock nuevo', 'Usuario'],
      d.movimientos.map((m) => [
        fechaHora(m.fecha), m.producto, this.nombreTipo(m.tipo), m.cantidad,
        m.stock_anterior, m.stock_nuevo, m.usuario,
      ])
    );
  }
}