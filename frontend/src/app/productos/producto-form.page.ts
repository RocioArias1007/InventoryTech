// ============================================================
// producto-form.page.ts
// Pantalla para crear un producto nuevo o actualizar uno existente.
// Si la dirección trae un número (/productos/5/editar), es para actualizar.
// La cantidad solo se escribe al crear; después cambia con ventas e ingresos.
// ============================================================

import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
  NavController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { camera, imageOutline, trash } from 'ionicons/icons';
import { CabeceraInternaComponent } from '../componentes/cabecera-interna/cabecera-interna.component';
import { AvisoService } from '../servicios/aviso.service';
import { Categoria, CategoriaService } from '../servicios/categoria.service';
import { DatosProducto, ProductoService } from '../servicios/producto.service';
import { mensajeDeError } from '../utilidades/errores';

@Component({
  selector: 'app-producto-form',
  templateUrl: 'producto-form.page.html',
  imports: [
    FormsModule,
    IonButton,
    IonContent,
    IonIcon,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    IonTextarea,
    CabeceraInternaComponent,
  ],
  styles: [`
    .dos-columnas { display: grid; grid-template-columns: 1fr 1fr; column-gap: 12px; }
    ion-select {
      width: 100%;
      --padding-start: 0;
      --padding-end: 0;
      min-height: 48px;
      color: var(--it-texto-oscuro);
    }
    ion-select::part(placeholder) { color: var(--it-texto-suave); opacity: 1; }
    .bloqueado { background: #f1f5f9; }
    .ayuda { margin: -10px 0 16px; font-size: 12px; color: var(--it-texto-suave); }

    .bloque-foto { display: flex; align-items: center; gap: 14px; margin-bottom: 18px; }
    .vista-foto {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      width: 84px;
      height: 84px;
      overflow: hidden;
      background: #f1f5f9;
      border: 1.5px dashed #cbd5e1;
      border-radius: 14px;
      color: var(--it-texto-suave);
    }
    .vista-foto ion-icon { font-size: 32px; }
    .vista-foto img { width: 100%; height: 100%; object-fit: cover; }
    .botones-foto { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
    .boton-foto {
      display: flex;
      align-items: center;
      gap: 6px;
      min-height: 40px;
      padding: 0;
      background: none;
      border: 0;
      font: inherit;
      font-size: 14px;
      font-weight: 700;
      color: var(--it-azul);
      cursor: pointer;
    }
    .boton-foto.roja { color: var(--it-rojo); }
  `],
  standalone: true,
})
export class ProductoFormPage implements OnInit, OnDestroy {
  private servicio = inject(ProductoService);
  private categoriaServicio = inject(CategoriaService);
  private aviso = inject(AvisoService);
  private nav = inject(NavController);
  private sanitizador = inject(DomSanitizer);
  private textoId = inject(ActivatedRoute).snapshot.paramMap.get('id');

  // Si la dirección trae un número, estamos actualizando; si no, creando.
  editando = this.textoId !== null;
  private id = this.editando ? Number(this.textoId) : 0;
  titulo = this.editando ? 'Actualizar Producto' : 'Agregar Nuevo Producto';
  textoBoton = this.editando ? 'Guardar Cambios' : 'Guardar Producto';

  // Lo que la persona escribe (los números se guardan como texto y se revisan al guardar).
  nombre = '';
  idCategoria: number | null = null;
  cantidad = ''; // solo al crear
  cantidadActual = 0; // solo al actualizar (se muestra bloqueada)
  stockMinimo = '';
  precioCompra = '';
  precioVenta = '';
  iva = '';
  descripcion = '';

    // Impide escribir el signo menos, el más y la "e" en los campos numéricos.
  bloquearSignos(evento: KeyboardEvent) {
    if (['-', '+', 'e', 'E'].includes(evento.key)) evento.preventDefault();
  }

  // Estados de la pantalla.
  categorias = signal<Categoria[]>([]);
  cargandoDatos = signal(true);
  guardando = signal(false);
  mensajeError = signal('');

  // Foto: lo que se ve, la foto nueva elegida y si hay que quitar la guardada.
  vistaFoto = signal<SafeUrl | null>(null);
  private urlVista = '';
  private fotoNueva: File | null = null;
  private tieneFotoGuardada = false;
  private marcadaParaQuitar = false;

  constructor() {
    addIcons({ camera, imageOutline, trash });
  }

  ngOnInit(): void {
    this.cargarInicial();
  }

  ngOnDestroy(): void {
    this.liberarVista();
  }

  // Carga las categorías (para el selector) y, si se actualiza, los datos del producto.
  private async cargarInicial(): Promise<void> {
    if (this.editando && (!Number.isInteger(this.id) || this.id < 1)) {
      this.salirConAviso('El producto no existe.');
      return;
    }
    try {
      this.categorias.set(await this.categoriaServicio.listar());
      if (this.editando) {
        const todos = await this.servicio.listar();
        const p = todos.find((x) => x.id_producto === this.id);
        if (!p) {
          this.salirConAviso('El producto no existe.');
          return;
        }
        this.nombre = p.nombre;
        this.idCategoria = p.id_categoria;
        this.cantidadActual = p.cantidad;
        this.stockMinimo = String(p.stock_minimo);
        this.precioCompra = p.precio_compra === undefined ? '' : String(p.precio_compra);
        this.precioVenta = String(p.precio_venta);
        this.iva = String(p.iva);
        this.descripcion = p.descripcion ?? '';
        this.tieneFotoGuardada = p.tiene_foto;
        if (p.tiene_foto) {
          await this.cargarFotoGuardada();
        }
      }
      this.cargandoDatos.set(false);
    } catch (error) {
      this.salirConAviso(mensajeDeError(error));
    }
  }

  // Descarga la foto que ya tiene el producto. Si falla, el producto se edita igual.
  private async cargarFotoGuardada(): Promise<void> {
    try {
      const blob = await this.servicio.verFoto(this.id);
      this.mostrarVista(blob);
    } catch {
      // Sin foto visible, pero se puede seguir editando.
    }
  }

  private salirConAviso(mensaje: string): void {
    this.aviso.mostrar(mensaje, 'danger');
    this.nav.navigateBack('/productos');
  }

  // ---------- Foto ----------

  // Muestra una imagen en el cuadrito de la foto.
  private mostrarVista(archivo: Blob): void {
    this.liberarVista();
    this.urlVista = URL.createObjectURL(archivo);
    this.vistaFoto.set(this.sanitizador.bypassSecurityTrustUrl(this.urlVista));
  }

  private liberarVista(): void {
    if (this.urlVista) {
      URL.revokeObjectURL(this.urlVista);
      this.urlVista = '';
    }
  }

  // Cuando la persona elige una foto de su galería o cámara.
  async alElegirFoto(evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    entrada.value = ''; // permite volver a elegir el mismo archivo
    if (!archivo) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(archivo.type)) {
      this.mensajeError.set('La foto debe ser JPG, PNG o WEBP.');
      return;
    }
    try {
      const reducida = await this.reducirFoto(archivo);
      this.mensajeError.set('');
      this.fotoNueva = reducida;
      this.marcadaParaQuitar = false;
      this.mostrarVista(reducida);
    } catch {
      this.mensajeError.set('No se pudo leer esa imagen. Prueba con otra.');
    }
  }

  // Achica la foto (máximo 800 píxeles) y la guarda como JPG liviano.
  private async reducirFoto(archivo: File): Promise<File> {
    const imagen = await createImageBitmap(archivo);
    const escala = Math.min(1, 800 / Math.max(imagen.width, imagen.height));
    const ancho = Math.round(imagen.width * escala);
    const alto = Math.round(imagen.height * escala);

    const lienzo = document.createElement('canvas');
    lienzo.width = ancho;
    lienzo.height = alto;
    const contexto = lienzo.getContext('2d');
    if (!contexto) throw new Error('Sin lienzo');

    // Fondo blanco, por si la imagen tiene partes transparentes.
    contexto.fillStyle = '#ffffff';
    contexto.fillRect(0, 0, ancho, alto);
    contexto.drawImage(imagen, 0, 0, ancho, alto);
    imagen.close();

    const blob = await new Promise<Blob | null>((resolver) =>
      lienzo.toBlob(resolver, 'image/jpeg', 0.8)
    );
    if (!blob) throw new Error('No se pudo reducir');
    return new File([blob], 'foto.jpg', { type: 'image/jpeg' });
  }

  // Quita la foto del formulario (si ya estaba guardada, se borra al guardar).
  quitar(): void {
    this.liberarVista();
    this.vistaFoto.set(null);
    this.fotoNueva = null;
    this.marcadaParaQuitar = this.tieneFotoGuardada;
  }

  // ---------- Guardar ----------

  // Convierte lo escrito a número. Vacío devuelve el valor por defecto (o null).
  private aNumero(texto: string | number | null | undefined, porDefecto: number | null = null): number | null {
    if (texto === null || texto === undefined || String(texto).trim() === '') return porDefecto;
    const numero = Number(String(texto).replace(',', '.'));
    return Number.isNaN(numero) ? null : numero;
  }

  // Máximo dos decimales (como pide el backend).
  private dosDecimales(n: number): boolean {
    return Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
  }

  private fallo(mensaje: string): null {
    this.mensajeError.set(mensaje);
    return null;
  }

  // Revisa los campos. Devuelve los datos listos, o null si hay un error.
  private validar(): DatosProducto | null {
    const nombre = this.nombre.trim();
    if (!nombre) return this.fallo('El nombre del producto es obligatorio.');
    if (this.idCategoria === null) return this.fallo('Elige una categoría.');

    const precioCompra = this.aNumero(this.precioCompra);
    if (precioCompra === null || precioCompra < 0 || precioCompra > 100000000 || !this.dosDecimales(precioCompra)) {
      return this.fallo('Escribe un precio de compra válido, entre 0 y 100.000.000 (sin puntos de miles).');
    }
    const precioVenta = this.aNumero(this.precioVenta);
    if (precioVenta === null || precioVenta < 0 || precioVenta > 100000000 || !this.dosDecimales(precioVenta)) {
      return this.fallo('Escribe un precio de venta válido, entre 0 y 100.000.000 (sin puntos de miles).');
    }

    const stockMinimo = this.aNumero(this.stockMinimo, 0);
    if (stockMinimo === null || !Number.isInteger(stockMinimo) || stockMinimo < 0 || stockMinimo > 1000000) {
      return this.fallo('El stock mínimo debe ser un número entero entre 0 y 1.000.000.');
    }
    const iva = this.aNumero(this.iva, 0);
    if (iva === null || iva < 0 || iva > 100 || !this.dosDecimales(iva)) {
      return this.fallo('El IVA debe ser un porcentaje entre 0 y 100.');
    }

    const datos: DatosProducto = {
      nombre,
      id_categoria: this.idCategoria,
      descripcion: this.descripcion.trim(),
      stock_minimo: stockMinimo,
      precio_compra: precioCompra,
      precio_venta: precioVenta,
      iva,
    };

    // La cantidad solo se envía al crear.
    if (!this.editando) {
      const cantidad = this.aNumero(this.cantidad, 0);
      if (cantidad === null || !Number.isInteger(cantidad) || cantidad < 0 || cantidad > 1000000) {
        return this.fallo('La cantidad inicial debe ser un número entero entre 0 y 1.000.000.');
      }
      datos.cantidad = cantidad;
    }
    return datos;
  }

  // Guarda el producto, luego la foto (si cambió) y vuelve a la lista.
  async guardar(): Promise<void> {
    if (this.guardando()) return;
    this.mensajeError.set('');
    const datos = this.validar();
    if (!datos) return;

    this.guardando.set(true);
    try {
      let idProducto = this.id;
      let mensaje: string;
      if (this.editando) {
        mensaje = (await this.servicio.actualizar(this.id, datos)).mensaje;
      } else {
        const respuesta = await this.servicio.crear(datos);
        mensaje = respuesta.mensaje;
        idProducto = respuesta.producto.id_producto;
      }

      // La foto es opcional: si falla, el producto ya quedó guardado.
      let problemaFoto = '';
      try {
        if (this.fotoNueva) {
          await this.servicio.subirFoto(idProducto, this.fotoNueva);
        } else if (this.marcadaParaQuitar && this.tieneFotoGuardada) {
          await this.servicio.eliminarFoto(idProducto);
        }
      } catch (error) {
        problemaFoto = mensajeDeError(error);
      }

      if (problemaFoto) {
        this.aviso.mostrar(`Producto guardado, pero la foto no se pudo subir: ${problemaFoto}`, 'warning');
      } else {
        this.aviso.mostrar(mensaje, 'success');
      }
      await this.nav.navigateBack('/productos');
    } catch (error) {
      this.mensajeError.set(mensajeDeError(error));
    } finally {
      this.guardando.set(false);
    }
  }
}