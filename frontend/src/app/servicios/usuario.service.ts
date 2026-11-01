import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../configuracion';

export type Rol = 'administrador' | 'empleado';

export interface Usuario {
  id_usuario: number;
  nombre: string;
  apellidos: string;
  usuario: string;
  correo: string | null;
  telefono: string | null;
  rol: Rol;
}

export interface DatosUsuario {
  nombre: string;
  apellidos: string;
  usuario: string;
  correo: string;
  contrasena?: string;
  telefono: string;
  rol: Rol;
}

@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private http = inject(HttpClient);

  listar(buscar = ''): Observable<{ usuarios: Usuario[] }> {
    let params = new HttpParams();
    if (buscar.trim()) params = params.set('buscar', buscar.trim());
    return this.http.get<{ usuarios: Usuario[] }>(`${API_URL}/usuarios`, { params });
  }

  crear(datos: DatosUsuario): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(`${API_URL}/usuarios`, datos);
  }

  actualizar(id: number, datos: DatosUsuario): Observable<{ mensaje: string }> {
    return this.http.put<{ mensaje: string }>(`${API_URL}/usuarios/${id}`, datos);
  }

  eliminar(id: number): Observable<{ mensaje: string }> {
    return this.http.delete<{ mensaje: string }>(`${API_URL}/usuarios/${id}`);
  }
}