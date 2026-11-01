// ============================================================
// categorias.page.ts
// Gestión de Categorías: lista con buscador, y acciones de actualizar y eliminar.
// ============================================================

import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import {
  AlertController,
  IonContent,
  IonIcon,
  IonInput,
  IonSpinner,
  NavController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { addCircleOutline, clipboard, create, search, trash } from 'ionicons/icons';
import { CabeceraInternaComponent } from '../componentes/cabecera-interna/cabecera-interna.component';
import { AvisoService } from '../servicios/aviso.service';
import { Categoria, CategoriaService } from '../servicios/categoria.service';
import { mensajeDeError } from '../utilidades/errores';

@Component({
  selector: 'app-categorias',
  templateUrl: 'categorias.page.html',
  styleUrls: ['categorias.page.scss'],
  imports: [IonContent, IonIcon, IonInput, IonSpinner, CabeceraInternaComponent],
  standalone: true,
})
export class CategoriasPage {
  private servicio = inject(CategoriaService);
  private aviso = inject(AvisoService);
  private alertas = inject(AlertController);
  private nav = inject(NavController);

  // Estado de la pantalla.
  lista = signal<Categoria[]>([]);
  cargando = signal(true);
  errorCarga = signal('');

  // Palabra del buscador.
  buscar = '';
  private temporizador?: ReturnType<typeof setTimeout>;
  private numeroPeticion = 0;

  constructor() {
    // Registra los iconos que usa esta pantalla.
    addIcons({ addCircleOutline, clipboard, create, search, trash });
  }

  // Ionic llama a esto cada vez que se entra a la pantalla: así la lista siempre está al día.
  ionViewWillEnter(): void {
    this.cargar();
  }

  // Pide la lista al backend (con la palabra de búsqueda, si hay).
  async cargar(): Promise<void> {
    // Si llegan respuestas fuera de orden (por escribir rápido), solo vale la última.
    const numero = ++this.numeroPeticion;
    this.errorCarga.set('');
    try {
      const datos = await this.servicio.listar(this.buscar);
      if (numero !== this.numeroPeticion) return;
      this.lista.set(datos);
    } catch (error) {
      if (numero !== this.numeroPeticion) return;
      this.errorCarga.set(mensajeDeError(error));
    } finally {
      if (numero === this.numeroPeticion) {
        this.cargando.set(false);
      }
    }
  }

  // Se llama cada vez que la persona escribe en el buscador.
  // Espera un momento a que termine de escribir antes de preguntar al backend.
  alBuscar(evento: Event): void {
    this.buscar = String((evento as CustomEvent).detail?.value ?? '');
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => this.cargar(), 300);
  }

  nueva(): void {
    this.nav.navigateForward('/categorias/nueva');
  }

  editar(categoria: Categoria): void {
    this.nav.navigateForward(['/categorias', categoria.id_categoria, 'editar']);
  }

  // Elimina una categoría. Si tiene productos, primero pide a cuál categoría se mueven.
  async eliminar(categoria: Categoria): Promise<void> {
    if (categoria.total_productos > 0) {
      await this.pedirDestino(categoria, categoria.total_productos);
      return;
    }

    const alerta = await this.alertas.create({
      header: 'Eliminar categoría',
      message: `¿Eliminar la categoría “${categoria.nombre}”? Esta acción no se puede deshacer.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: () => {
            this.ejecutarEliminacion(categoria);
          },
        },
      ],
    });
    await alerta.present();
  }

  // Manda la orden de eliminar al backend (con la categoría de destino, si hace falta).
  private async ejecutarEliminacion(categoria: Categoria, destino?: number): Promise<void> {
    try {
      const respuesta = await this.servicio.eliminar(categoria.id_categoria, destino);
      this.aviso.mostrar(respuesta.mensaje, 'success');
    } catch (error) {
      // El backend avisa si todavía quedan productos asociados (por ejemplo, productos ya eliminados).
      if (
        error instanceof HttpErrorResponse &&
        error.status === 409 &&
        typeof error.error?.total_productos === 'number'
      ) {
        await this.pedirDestino(categoria, error.error.total_productos);
        return;
      }
      this.aviso.mostrar(mensajeDeError(error), 'danger');
    }
    await this.cargar();
  }

  // Abre la ventana para elegir a qué categoría se mueven los productos.
  private async pedirDestino(categoria: Categoria, total: number): Promise<void> {
    // Pedimos la lista completa: la de la pantalla puede estar filtrada por el buscador.
    let todas: Categoria[];
    try {
      todas = await this.servicio.listar();
    } catch (error) {
      this.aviso.mostrar(mensajeDeError(error), 'danger');
      return;
    }

    const otras = todas.filter((c) => c.id_categoria !== categoria.id_categoria);
    const productos = total === 1 ? '1 producto' : `${total} productos`;

    // Si no hay otra categoría, no hay a dónde moverlos.
    if (otras.length === 0) {
      const aviso = await this.alertas.create({
        header: 'No se puede eliminar',
        message: `“${categoria.nombre}” tiene ${productos} y no hay otra categoría a la que moverlos. Crea primero otra categoría.`,
        buttons: ['Entendido'],
      });
      await aviso.present();
      return;
    }

    // Si el backend cuenta más productos que la lista, es por los productos eliminados.
    const nota =
      total > categoria.total_productos
        ? ' Se cuentan también los productos eliminados, porque conservan su historial.'
        : '';

    const alerta = await this.alertas.create({
      header: 'Mover productos',
      message: `“${categoria.nombre}” tiene ${productos}. Elige a qué categoría se moverán antes de eliminarla.${nota}`,
      inputs: otras.map((c) => ({
        type: 'radio' as const,
        label: c.nombre,
        value: c.id_categoria,
      })),
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Mover y eliminar',
          role: 'destructive',
          handler: (destino?: number) => {
            // Si no eligió ninguna, la ventana se queda abierta.
            if (!destino) {
              this.aviso.mostrar('Elige la categoría de destino.', 'warning');
              return false;
            }
            this.ejecutarEliminacion(categoria, destino);
            return true;
          },
        },
      ],
    });
    await alerta.present();
  }
}