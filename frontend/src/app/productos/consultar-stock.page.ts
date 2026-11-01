// ============================================================
// consultar-stock.page.ts
// Consultar Stock (empleado): lista de productos solo de lectura,
// con buscador, filtro por estado y foto. No se puede crear,
// actualizar, ingresar ni eliminar.
// ============================================================

import { Component, OnDestroy, inject, signal } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import {
  AlertController,
  IonContent,
  IonIcon,
  IonInput,
  IonSpinner,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { clipboard, filter, search } from 'ionicons/icons';
import { CabeceraInternaComponent } from '../componentes/cabecera-interna/cabecera-interna.component';
import { EstadoStock, Producto, ProductoService } from '../servicios/producto.service';
import { mensajeDeError } from '../utilidades/errores';
import { formatearPesos } from '../utilidades/formato';

@Component({
  selector: 'app-consultar-stock',
  templateUrl: 'consultar-stock.page.html',
  // Usa los mismos estilos que la lista de productos del administrador.
  styleUrls: ['../productos/productos.page.scss'],
  styles: [`
    /* Sin fila de botones, la tarjeta necesita el mismo espacio abajo que arriba. */
    .producto.solo-lectura { padding-bottom: 14px; }
  `],
  imports: [IonContent, IonIcon, IonInput, IonSpinner, CabeceraInternaComponent],
  standalone: true,
})
export class ConsultarStockPage implements OnDestroy {
  private servicio = inject(ProductoService);
  private alertas = inject(AlertController);
  private sanitizador = inject(DomSanitizer);

  // Estado de la pantalla.
  lista = signal<Producto[]>([]);
  cargando = signal(true);
  errorCarga = signal('');

  // Fotos ya descargadas, por número de producto.
  fotos = signal<Record<number, SafeUrl>>({});
  private urls = new Map<number, string>();

  // Buscador y filtro.
  buscar = '';
  estado: '' | EstadoStock = '';
  private temporizador?: ReturnType<typeof setTimeout>;
  private numeroPeticion = 0;

  // Para usar estas piezas desde el HTML.
  formatear = formatearPesos;
  etiquetas: Record<EstadoStock, string> = {
    disponible: 'Disponible',
    bajo: 'Stock Bajo',
    agotado: 'Agotado',
  };

  constructor() {
    addIcons({ clipboard, filter, search });
  }

  // Ionic llama a esto cada vez que se entra a la pantalla: así el stock está al día.
  ionViewWillEnter(): void {
    this.limpiarFotos();
    this.cargar();
  }

  ngOnDestroy(): void {
    clearTimeout(this.temporizador);
    this.limpiarFotos();
  }

  // Pide la lista al backend (con buscador y filtro, si hay).
  async cargar(): Promise<void> {
    const numero = ++this.numeroPeticion;
    this.errorCarga.set('');
    try {
      const datos = await this.servicio.listar({
        buscar: this.buscar,
        estado: this.estado || undefined,
      });
      if (numero !== this.numeroPeticion) return;
      this.lista.set(datos);
      this.cargarFotos(datos);
    } catch (error) {
      if (numero !== this.numeroPeticion) return;
      this.errorCarga.set(mensajeDeError(error));
    } finally {
      if (numero === this.numeroPeticion) {
        this.cargando.set(false);
      }
    }
  }

  // Descarga las fotos de los productos que tienen una (sin frenar la lista).
  private cargarFotos(productos: Producto[]): void {
    for (const p of productos) {
      if (!p.tiene_foto || this.urls.has(p.id_producto)) continue;
      this.urls.set(p.id_producto, ''); // marca "en camino" para no pedirla dos veces
      this.servicio
        .verFoto(p.id_producto)
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          this.urls.set(p.id_producto, url);
          this.fotos.update((f) => ({
            ...f,
            [p.id_producto]: this.sanitizador.bypassSecurityTrustUrl(url),
          }));
        })
        .catch(() => this.urls.delete(p.id_producto));
    }
  }

  // Libera la memoria de las fotos descargadas.
  private limpiarFotos(): void {
    for (const url of this.urls.values()) {
      if (url) URL.revokeObjectURL(url);
    }
    this.urls.clear();
    this.fotos.set({});
  }

  // Espera un momento a que termine de escribir antes de preguntar al backend.
  alBuscar(evento: Event): void {
    this.buscar = String((evento as CustomEvent).detail?.value ?? '');
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => this.cargar(), 300);
  }

  // Ventana para filtrar por estado de stock.
  async elegirEstado(): Promise<void> {
    const opciones: { texto: string; valor: '' | EstadoStock }[] = [
      { texto: 'Todos', valor: '' },
      { texto: 'Disponible', valor: 'disponible' },
      { texto: 'Stock bajo', valor: 'bajo' },
      { texto: 'Agotado', valor: 'agotado' },
    ];
    const alerta = await this.alertas.create({
      header: 'Filtrar por estado',
      inputs: opciones.map((o) => ({
        type: 'radio' as const,
        label: o.texto,
        value: o.valor,
        checked: this.estado === o.valor,
      })),
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Aplicar',
          handler: (valor: '' | EstadoStock) => {
            this.estado = valor ?? '';
            this.cargar();
          },
        },
      ],
    });
    await alerta.present();
  }
}