// ============================================================
// categoria.service.ts
// Habla con el backend para listar, crear, actualizar y eliminar categorías.
// ============================================================

import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../configuracion';

export interface Categoria {
  id_categoria: number;
  nombre: string;
  descripcion: string | null;
  total_productos: number;
}

export interface DatosCategoria {
  nombre: string;
  descripcion: string;
}

interface RespuestaMensaje {
  mensaje: string;
}

@Injectable({ providedIn: 'root' })
export class CategoriaService {
  private http = inject(HttpClient);

  // Lista las categorías. Si hay una palabra de búsqueda, filtra por nombre.
  async listar(buscar = ''): Promise<Categoria[]> {
    let parametros = new HttpParams();
    if (buscar.trim()) {
      parametros = parametros.set('buscar', buscar.trim());
    }
    const respuesta = await firstValueFrom(
      this.http.get<{ categorias: Categoria[] }>(`${API_URL}/categorias`, { params: parametros })
    );
    // Aseguramos que el conteo sea un número.
    return respuesta.categorias.map((c) => ({ ...c, total_productos: Number(c.total_productos) }));
  }

  crear(datos: DatosCategoria): Promise<RespuestaMensaje> {
    return firstValueFrom(this.http.post<RespuestaMensaje>(`${API_URL}/categorias`, datos));
  }

  actualizar(id: number, datos: DatosCategoria): Promise<RespuestaMensaje> {
    return firstValueFrom(this.http.put<RespuestaMensaje>(`${API_URL}/categorias/${id}`, datos));
  }

  // Elimina una categoría. Si tiene productos, hay que indicar a cuál se mueven.
  eliminar(id: number, reasignarA?: number): Promise<RespuestaMensaje> {
    let parametros = new HttpParams();
    if (reasignarA !== undefined) {
      parametros = parametros.set('reasignar_a', String(reasignarA));
    }
    return firstValueFrom(
      this.http.delete<RespuestaMensaje>(`${API_URL}/categorias/${id}`, { params: parametros })
    );
  }
}