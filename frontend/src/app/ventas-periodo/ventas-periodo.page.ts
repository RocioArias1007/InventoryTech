import { Component, computed, inject, signal } from '@angular/core';
import { IonContent, IonButton, IonSpinner, IonSelect, IonSelectOption } from '@ionic/angular';
import { CabeceraInternaComponent } from '../componentes/cabecera-interna/cabecera-interna.component';
import { DemandaService, ProductoSimple, ResultadoDemanda } from '../servicios/demanda.service';
import { mensajeDeError } from '../utilidades/errores';

function textoFecha(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

@Component({
  selector: 'app-ventas-periodo',
  standalone: true,
  imports: [IonContent, IonButton, IonSpinner, IonSelect, IonSelectOption, CabeceraInternaComponent],
  templateUrl: './ventas-periodo.page.html',
  styleUrls: ['./ventas-periodo.page.scss'],
})
export class VentasPeriodoPage {
  private servicio = inject(DemandaService);

  productos = signal<ProductoSimple[]>([]);
  cargandoProductos = signal(true);
  calculando = signal(false);
  error = signal('');
  resultado = signal<ResultadoDemanda | null>(null);

  producto = signal<number | null>(null);
  desde = signal('');
  hasta = signal('');
  hoy = textoFecha(new Date());

  maximo = computed(() => {
    const r = this.resultado();
    return r ? Math.max(1, ...r.serie.map((p) => p.unidades)) : 1;
  });

  ionViewWillEnter() {
    const fin = new Date();
    const inicio = new Date();
    inicio.setDate(inicio.getDate() - 6);
    this.hasta.set(textoFecha(fin));
    this.desde.set(textoFecha(inicio));
    this.resultado.set(null);
    this.error.set('');

    this.cargandoProductos.set(true);
    this.servicio.productos().subscribe({
      next: (r) => {
        this.productos.set(r.productos);
        this.cargandoProductos.set(false);
      },
      error: (e) => {
        this.error.set(mensajeDeError(e));
        this.cargandoProductos.set(false);
      },
    });
  }

  calcular() {
    this.error.set('');
    if (this.producto() === null) {
      this.error.set('Elige un producto.');
      return;
    }
    if (!this.desde() || !this.hasta()) {
      this.error.set('Elige las dos fechas.');
      return;
    }
    if (this.desde() > this.hasta()) {
      this.error.set('La fecha "Desde" no puede ser posterior a "Hasta".');
      return;
    }
    this.calculando.set(true);
    this.servicio.calcular(this.producto()!, this.desde(), this.hasta()).subscribe({
      next: (r) => {
        this.resultado.set(r);
        this.calculando.set(false);
      },
      error: (e) => {
        this.resultado.set(null);
        this.error.set(mensajeDeError(e));
        this.calculando.set(false);
      },
    });
  }

  altura(unidades: number): string {
    return `${Math.round((unidades / this.maximo()) * 100)}%`;
  }

  etiquetaDia(dia: string): string {
    return dia.slice(8, 10) + '/' + dia.slice(5, 7);
  }
}