// ============================================================
// producto.service.ts
// Habla con el backend para listar, crear, actualizar y eliminar productos,
// registrar ingresos de mercancía y manejar la foto.
// ============================================================

import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../configuracion';

export type EstadoStock = 'disponible' | 'bajo' | 'agotado';

export interface Producto {
  id_producto: number;
  nombre: string;
  descripcion: string | null;
  cantidad: number;
  stock_minimo: number;
  precio_venta: number;
  // Solo viene cuando quien consulta es administrador.
  precio_compra?: number;
  iva: number;
  id_categoria: number;
  categoria: string;
  tiene_foto: boolean;
  estado: EstadoStock;
}

// Lo que se envía al crear o actualizar un producto.
export interface DatosProducto {
  nombre: string;
  id_categoria: number;
  descripcion: string;
  stock_minimo: number;
  precio_compra: number;
  precio_venta: number;
  iva: number;
  // Solo se envía al crear: al actualizar, el backend ignora la cantidad.
  cantidad?: number;
}

export interface FiltrosProducto {
  buscar?: string;
  estado?: EstadoStock;
  categoria?: number;
}

interface RespuestaMensaje {
  mensaje: string;
}

@Injectable({ providedIn: 'root' })
export class ProductoService {
  private http = inject(HttpClient);

  // Lista los productos activos. Los filtros son opcionales.
  async listar(filtros: FiltrosProducto = {}): Promise<Producto[]> {
    let parametros = new HttpParams();
    if (filtros.buscar?.trim()) {
      parametros = parametros.set('buscar', filtros.buscar.trim());
    }
    if (filtros.estado) {
      parametros = parametros.set('estado', filtros.estado);
    }
    if (filtros.categoria) {
      parametros = parametros.set('categoria', String(filtros.categoria));
    }
    const respuesta = await firstValueFrom(
      this.http.get<{ productos: Producto[] }>(`${API_URL}/productos`, { params: parametros })
    );
    // MySQL manda los precios como texto ("4500.00"): los convertimos a número.
    return respuesta.productos.map((p) => ({
      ...p,
      cantidad: Number(p.cantidad),
      stock_minimo: Number(p.stock_minimo),
      precio_venta: Number(p.precio_venta),
      precio_compra: p.precio_compra === undefined ? undefined : Number(p.precio_compra),
      iva: Number(p.iva),
    }));
  }

  crear(datos: DatosProducto): Promise<RespuestaMensaje & { producto: { id_producto: number } }> {
    return firstValueFrom(
      this.http.post<RespuestaMensaje & { producto: { id_producto: number } }>(
        `${API_URL}/productos`,
        datos
      )
    );
  }

  actualizar(id: number, datos: DatosProducto): Promise<RespuestaMensaje> {
    return firstValueFrom(this.http.put<RespuestaMensaje>(`${API_URL}/productos/${id}`, datos));
  }

  eliminar(id: number): Promise<RespuestaMensaje> {
    return firstValueFrom(this.http.delete<RespuestaMensaje>(`${API_URL}/productos/${id}`));
  }

  // Suma al inventario las unidades que llegaron. El precio de compra es opcional.
  ingresar(id: number, cantidad: number, precioCompra?: number): Promise<RespuestaMensaje> {
    const cuerpo: { cantidad: number; precio_compra?: number } = { cantidad };
    if (precioCompra !== undefined) {
      cuerpo.precio_compra = precioCompra;
    }
    return firstValueFrom(
      this.http.post<RespuestaMensaje>(`${API_URL}/productos/${id}/ingreso`, cuerpo)
    );
  }

  // Guarda o reemplaza la foto. El archivo viaja tal cual, con su tipo (jpg, png o webp).
  subirFoto(id: number, archivo: File): Promise<RespuestaMensaje> {
    return firstValueFrom(
      this.http.put<RespuestaMensaje>(`${API_URL}/productos/${id}/foto`, archivo, {
        headers: { 'Content-Type': archivo.type },
      })
    );
  }

  // Descarga la foto como archivo (blob) para poder mostrarla.
  verFoto(id: number): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${API_URL}/productos/${id}/foto`, { responseType: 'blob' })
    );
  }

  eliminarFoto(id: number): Promise<RespuestaMensaje> {
    return firstValueFrom(this.http.delete<RespuestaMensaje>(`${API_URL}/productos/${id}/foto`));
  }
}