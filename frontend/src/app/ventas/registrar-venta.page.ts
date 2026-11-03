// ============================================================
// registrar-venta.page.ts
// Registrar Venta: se eligen productos, se arma el ticket y se cobra.
// La regla de stock la aplica el backend; aquí solo se avisa antes por comodidad.
// ============================================================

import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonSpinner,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { cash, close, search } from 'ionicons/icons';
import { CabeceraInternaComponent } from '../componentes/cabecera-interna/cabecera-interna.component';
import { AvisoService } from '../servicios/aviso.service';
import { Producto, ProductoService } from '../servicios/producto.service';
import { SesionService } from '../servicios/sesion.service';
import { VentaRegistrada, VentaService } from '../servicios/venta.service';
import { mensajeDeError } from '../utilidades/errores';
import { formatearPesos } from '../utilidades/formato';
import { imprimirTicket as ticketPdf } from '../utilidades/exportar';

// Un renglón del ticket: el producto y cuántas unidades lleva.
interface LineaTicket {
  producto: Producto;
  cantidad: number;
}

@Component({
  selector: 'app-registrar-venta',
  templateUrl: 'registrar-venta.page.html',
  styleUrls: ['registrar-venta.page.scss'],
  imports: [
    IonButton,
    IonContent,
    IonIcon,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    CabeceraInternaComponent,
  ],
  standalone: true,
})
export class RegistrarVentaPage {
  private productoServicio = inject(ProductoService);
  private ventaServicio = inject(VentaService);
  private aviso = inject(AvisoService);
  private sesion = inject(SesionService);

  // El administrador vuelve a su panel y el empleado al suyo.
  rutaVolver = this.sesion.rutaInicio(this.sesion.usuario?.rol ?? 'empleado');

  // Para usar desde el HTML.
  formatear = formatearPesos;

  // Productos del backend y estado de la carga.
  productos = signal<Producto[]>([]);
  cargando = signal(true);
  errorCarga = signal('');

  // Selección rápida.
  categoria = signal(0); // 0 = todas
  texto = signal('');
  seleccionado = signal<Producto | null>(null);
  cantidad = signal('1');

  // Ticket y cobro.
  ticket = signal<LineaTicket[]>([]);
  efectivo = signal('');
  cobrando = signal(false);

  // Categorías para el filtro, sacadas de los mismos productos.
  categorias = computed(() => {
    const mapa = new Map<number, string>();
    for (const p of this.productos()) mapa.set(p.id_categoria, p.categoria);
    return [...mapa.entries()]
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  });

  // La lista de resultados se muestra si hay algo escrito o una categoría elegida.
  hayBusqueda = computed(
    () => !this.seleccionado() && (this.texto().trim() !== '' || this.categoria() !== 0)
  );

  sugerencias = computed(() => {
    if (!this.hayBusqueda()) return [];
    const texto = this.normalizar(this.texto().trim());
    const categoria = this.categoria();
    return this.productos()
      .filter(
        (p) =>
          (categoria === 0 || p.id_categoria === categoria) &&
          (texto === '' || this.normalizar(p.nombre).includes(texto))
      )
      .slice(0, 30);
  });

  // Se puede agregar solo si hay un producto elegido y no está agotado.
  puedeAgregar = computed(() => {
    const p = this.seleccionado();
    return !!p && p.cantidad > 0;
  });

  // Subtotal, IVA y total, calculados igual que el backend (en centavos enteros).
  // El precio de venta YA incluye el IVA.
  resumen = computed(() => {
    let total = 0;
    let base = 0;
    for (const l of this.ticket()) {
      const totalLinea = Math.round(l.producto.precio_venta * 100) * l.cantidad;
      total += totalLinea;
      base += Math.round(totalLinea / (1 + l.producto.iva / 100));
    }
    return { total: total / 100, subtotal: base / 100, iva: (total - base) / 100 };
  });

  // Cambio / vueltas: solo si el efectivo alcanza.
  cambio = computed(() => {
    const texto = this.efectivo().trim();
    if (texto === '') return 0;
    const recibido = Number(texto.replace(',', '.'));
    const total = this.resumen().total;
    if (Number.isNaN(recibido) || recibido < total) return 0;
    return Math.round((recibido - total) * 100) / 100;
  });

  constructor() {
    addIcons({ cash, close, search });
  }

  // Ionic llama a esto cada vez que se entra a la pantalla: así el stock está al día.
  ionViewWillEnter(): void {
    this.cargarProductos();
  }

  // Pide los productos al backend.
  async cargarProductos(): Promise<void> {
    this.errorCarga.set('');
    try {
      this.productos.set(await this.productoServicio.listar());
    } catch (error) {
      this.errorCarga.set(mensajeDeError(error));
    } finally {
      this.cargando.set(false);
    }
  }

  // Quita tildes y mayúsculas para que "cafe" encuentre "Café".
  private normalizar(texto: string): string {
    return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  // ---------- Selección rápida ----------

  alCambiarCategoria(evento: Event): void {
    this.categoria.set(Number((evento as CustomEvent).detail?.value ?? 0));
    this.seleccionado.set(null);
    this.texto.set('');
  }

  // Cada vez que se escribe en el buscador.
  alBuscar(evento: Event): void {
    const valor = String((evento as CustomEvent).detail?.value ?? '');
    this.texto.set(valor);
    const elegido = this.seleccionado();
    if (elegido && valor !== elegido.nombre) {
      this.seleccionado.set(null);
    }
  }

  // Cuando se toca un resultado de la lista.
  elegir(producto: Producto): void {
    this.seleccionado.set(producto);
    this.texto.set(producto.nombre);
  }

  // Agrega el producto elegido al ticket (si ya estaba, suma las unidades).
  agregar(): void {
    const producto = this.seleccionado();
    if (!producto) {
      this.aviso.mostrar('Busca y elige un producto primero.', 'warning');
      return;
    }
    const unidades = Number(this.cantidad());
    if (!Number.isInteger(unidades) || unidades < 1) {
      this.aviso.mostrar('La cantidad debe ser un número entero de 1 en adelante.', 'warning');
      return;
    }

    const lineas = this.ticket();
    const yaEnTicket = lineas.find((l) => l.producto.id_producto === producto.id_producto);
    const total = (yaEnTicket?.cantidad ?? 0) + unidades;

    // Aviso por comodidad. La regla de verdad la aplica el backend al cobrar.
    if (total > producto.cantidad) {
      this.aviso.mostrar(
        `Solo hay ${producto.cantidad} ${producto.cantidad === 1 ? 'unidad' : 'unidades'} de “${producto.nombre}”.`,
        'warning'
      );
      return;
    }

    if (yaEnTicket) {
      this.ticket.set(
        lineas.map((l) => (l === yaEnTicket ? { ...l, cantidad: total } : l))
      );
    } else {
      this.ticket.set([...lineas, { producto, cantidad: unidades }]);
    }

    // Deja todo listo para el siguiente producto.
    this.seleccionado.set(null);
    this.texto.set('');
    this.cantidad.set('1');
  }

  quitar(idProducto: number): void {
    this.ticket.set(this.ticket().filter((l) => l.producto.id_producto !== idProducto));
  }

  // ---------- Cobrar ----------

  async cobrar(): Promise<void> {
    if (this.cobrando()) return;
    if (this.ticket().length === 0) {
      this.aviso.mostrar('Agrega al menos un producto al ticket.', 'warning');
      return;
    }

    // El efectivo es opcional, pero si se escribe tiene que alcanzar.
    let efectivo: number | undefined;
    const texto = this.efectivo().trim();
    if (texto !== '') {
      const valor = Number(texto.replace(',', '.'));
      if (Number.isNaN(valor) || valor < 0) {
        this.aviso.mostrar('El efectivo recibido no es válido.', 'warning');
        return;
      }
      if (valor < this.resumen().total) {
        this.aviso.mostrar('El efectivo recibido no alcanza para pagar el total.', 'warning');
        return;
      }
      efectivo = valor;
    }

    this.cobrando.set(true);
    try {
      const items = this.ticket().map((l) => ({
        id_producto: l.producto.id_producto,
        cantidad: l.cantidad,
      }));
      const respuesta = await this.ventaServicio.registrar(items, efectivo);

      // La venta ya quedó guardada: ahora se imprime y se limpia la pantalla.
      this.imprimirTicket(respuesta.venta);

      const alertas = respuesta.alertas_stock_bajo ?? [];
      if (alertas.length > 0) {
        const nombres = alertas.map((a) => `${a.nombre} (${a.cantidad})`).join(', ');
        this.aviso.mostrar(`${respuesta.mensaje} Stock bajo: ${nombres}.`, 'warning');
      } else {
        this.aviso.mostrar(respuesta.mensaje, 'success');
      }

      this.ticket.set([]);
      this.efectivo.set('');
      this.seleccionado.set(null);
      this.texto.set('');
      this.cantidad.set('1');
      await this.cargarProductos();
    } catch (error) {
      // El backend avisa qué productos no alcanzan (otra venta pudo llevarse el stock).
      if (
        error instanceof HttpErrorResponse &&
        error.status === 409 &&
        Array.isArray(error.error?.faltantes)
      ) {
        const lista = (error.error.faltantes as { nombre: string; solicitadas: number; disponibles: number }[])
          .map((f) => `${f.nombre} (pides ${f.solicitadas}, hay ${f.disponibles})`)
          .join('; ');
        this.aviso.mostrar(`No hay suficiente stock: ${lista}.`, 'danger');
        await this.cargarProductos();
      } else {
        this.aviso.mostrar(mensajeDeError(error), 'danger');
      }
    } finally {
      this.cobrando.set(false);
    }
  }

    // ---------- Imprimir ----------

  // Genera el ticket en PDF (en el celular se comparte o se guarda).
  private imprimirTicket(venta: VentaRegistrada): void {
    ticketPdf({
      numero: venta.id_venta,
      fecha: new Date(venta.fecha_venta).toLocaleString('es-CO'),
      vendedor: venta.vendedor,
      items: venta.items.map((i) => ({
        nombre: i.nombre,
        detalle: `${i.cantidad} un. x ${formatearPesos(i.precio_und)}`,
        total: formatearPesos(i.total),
      })),
      subtotal: formatearPesos(venta.subtotal),
      iva: formatearPesos(venta.iva_total),
      total: formatearPesos(venta.total),
      efectivo: venta.efectivo_recibido !== undefined ? formatearPesos(venta.efectivo_recibido) : undefined,
      cambio: venta.efectivo_recibido !== undefined ? formatearPesos(venta.cambio ?? 0) : undefined,
    }).catch(() => {
      this.aviso.mostrar('La venta se guardó, pero no se pudo generar el ticket.', 'warning');
    });
  }
}
