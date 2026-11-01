// ============================================================
// productos.page.ts
// Gestión de Productos: lista con buscador, filtro por estado, foto,
// y acciones de actualizar, ingreso de mercancía y eliminar.
// ============================================================

import { Component, OnDestroy, inject, signal } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import {
  AlertController,
  IonContent,
  IonIcon,
  IonInput,
  IonSpinner,
  NavController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { addCircleOutline, clipboard, create, download, filter, search, trash } from 'ionicons/icons';
import { CabeceraInternaComponent } from '../componentes/cabecera-interna/cabecera-interna.component';
import { AvisoService } from '../servicios/aviso.service';
import { EstadoStock, Producto, ProductoService } from '../servicios/producto.service';
import { mensajeDeError } from '../utilidades/errores';
import { formatearPesos } from '../utilidades/formato';

@Component({
  selector: 'app-productos',
  templateUrl: 'productos.page.html',
  styleUrls: ['productos.page.scss'],
  imports: [IonContent, IonIcon, IonInput, IonSpinner, CabeceraInternaComponent],
  standalone: true,
})
export class ProductosPage implements OnDestroy {
  private servicio = inject(ProductoService);
  private aviso = inject(AvisoService);
  private alertas = inject(AlertController);
  private nav = inject(NavController);
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
    addIcons({ addCircleOutline, clipboard, create, download, filter, search, trash });
  }

  // Ionic llama a esto cada vez que se entra a la pantalla: así todo está al día.
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

  nuevo(): void {
    this.nav.navigateForward('/productos/nuevo');
  }

  editar(producto: Producto): void {
    this.nav.navigateForward(['/productos', producto.id_producto, 'editar']);
  }

  // Ventana para registrar la mercancía que llegó.
  async ingreso(producto: Producto): Promise<void> {
    const alerta = await this.alertas.create({
      header: 'Ingreso de mercancía',
      message: `“${producto.nombre}”: hoy hay ${producto.cantidad}. Escribe cuántas unidades llegaron y el precio de compra por unidad.`,
      inputs: [
        { name: 'cantidad', type: 'number', placeholder: 'Cantidad que llegó', min: 1 },
        {
          name: 'precio',
          type: 'number',
          placeholder: 'Precio de compra',
          value: producto.precio_compra ?? '',
          min: 0,
        },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar ingreso',
          handler: (datos: { cantidad: string; precio: string }) => {
            const cantidad = Number(datos.cantidad);
            if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 1000000) {
              this.aviso.mostrar('La cantidad debe ser un número entero de 1 en adelante.', 'warning');
              return false;
            }
            let precio: number | undefined;
            if (String(datos.precio ?? '').trim() !== '') {
              precio = Number(datos.precio);
              if (Number.isNaN(precio) || precio < 0 || precio > 100000000) {
                this.aviso.mostrar('El precio de compra no es válido.', 'warning');
                return false;
              }
            }
            this.ejecutarIngreso(producto, cantidad, precio);
            return true;
          },
        },
      ],
    });
    await alerta.present();
  }

  private async ejecutarIngreso(producto: Producto, cantidad: number, precio?: number): Promise<void> {
    try {
      const respuesta = await this.servicio.ingresar(producto.id_producto, cantidad, precio);
      this.aviso.mostrar(respuesta.mensaje, 'success');
    } catch (error) {
      this.aviso.mostrar(mensajeDeError(error), 'danger');
    }
    await this.cargar();
  }

  // Pide confirmación antes de eliminar. Las ventas viejas conservan su historial.
  async eliminar(producto: Producto): Promise<void> {
    const alerta = await this.alertas.create({
      header: 'Eliminar producto',
      message: `¿Eliminar “${producto.nombre}”? Las ventas anteriores conservan su historial.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: () => {
            this.ejecutarEliminacion(producto);
          },
        },
      ],
    });
    await alerta.present();
  }

  private async ejecutarEliminacion(producto: Producto): Promise<void> {
    try {
      const respuesta = await this.servicio.eliminar(producto.id_producto);
      this.aviso.mostrar(respuesta.mensaje, 'success');
    } catch (error) {
      this.aviso.mostrar(mensajeDeError(error), 'danger');
    }
    await this.cargar();
  }
}