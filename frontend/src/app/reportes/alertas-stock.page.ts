import { Component, inject, signal } from '@angular/core';
import { IonContent, IonButton, IonIcon, IonSpinner } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { print, download, checkmarkCircle } from 'ionicons/icons';
import { CabeceraInternaComponent } from '../componentes/cabecera-interna/cabecera-interna.component';
import { ReporteService, RespuestaStockBajo } from '../servicios/reporte.service';
import { mensajeDeError } from '../utilidades/errores';
import { descargarCsv, imprimir } from '../utilidades/exportar';

@Component({
  selector: 'app-alertas-stock',
  standalone: true,
  imports: [IonContent, IonButton, IonIcon, IonSpinner, CabeceraInternaComponent],
  templateUrl: './alertas-stock.page.html',
  styleUrls: ['./alertas-stock.page.scss'],
})
export class AlertasStockPage {
  private servicio = inject(ReporteService);

  datos = signal<RespuestaStockBajo | null>(null);
  cargando = signal(true);
  error = signal('');

  constructor() {
    addIcons({ print, download, checkmarkCircle });
  }

  ionViewWillEnter() {
    this.cargar();
  }

  cargar() {
    this.cargando.set(true);
    this.error.set('');
    this.servicio.stockBajo().subscribe({
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

    imprimir() {
    const d = this.datos();
    if (!d) return;
    const agotados = d.productos.filter((p) => p.estado === 'agotado').length;

    imprimir({
      titulo: 'Alertas de stock',
      subtitulo: `Productos con poco inventario al ${new Date().toLocaleDateString('es-CO')}`,
      columnas: ['Producto', 'Categoría', 'Cantidad', 'Stock mínimo', 'Estado'],
      filas: d.productos.map((p) => [
        p.nombre,
        p.categoria,
        p.cantidad,
        p.stock_minimo,
        p.estado === 'agotado' ? 'Agotado' : 'Stock bajo',
      ]),
      resumen: [
        { etiqueta: 'Productos en alerta', valor: d.productos.length },
        { etiqueta: 'Agotados', valor: agotados },
      ],
    });
  }

    exportar() {
    const d = this.datos();
    if (!d) return;
    const hoy = new Date().toISOString().slice(0, 10);
    descargarCsv(
      `alertas-stock-${hoy}`,
      ['Producto', 'Categoría', 'Cantidad', 'Stock mínimo', 'Estado'],
      d.productos.map((p) => [
        p.nombre,
        p.categoria,
        p.cantidad,
        p.stock_minimo,
        p.estado === 'agotado' ? 'Agotado' : 'Stock bajo',
      ])
    );
  }
}