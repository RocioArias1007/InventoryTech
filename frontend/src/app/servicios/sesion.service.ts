// ============================================================
// sesion.service.ts
// Recuerda quién inició sesión: guarda la "manilla" (token) y los datos del usuario.
// ============================================================

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../configuracion';

export type RolUsuario = 'administrador' | 'empleado';

export interface UsuarioSesion {
  id_usuario: number;
  nombre: string;
  apellidos: string;
  usuario: string;
  rol: RolUsuario;
}

interface RespuestaLogin {
  token: string;
  usuario: UsuarioSesion;
}

// Nombres con los que se guardan los datos en el dispositivo.
const CLAVE_TOKEN = 'inventorytech_token';
const CLAVE_USUARIO = 'inventorytech_usuario';

@Injectable({ providedIn: 'root' })
export class SesionService {
  private http = inject(HttpClient);
  private router = inject(Router);

  // Envía usuario y contraseña al backend. Si son correctos, guarda la sesión.
  async iniciarSesion(usuario: string, contrasena: string): Promise<UsuarioSesion> {
    const respuesta = await firstValueFrom(
      this.http.post<RespuestaLogin>(`${API_URL}/auth/login`, { usuario, contrasena })
    );
    this.guardar(CLAVE_TOKEN, respuesta.token);
    this.guardar(CLAVE_USUARIO, JSON.stringify(respuesta.usuario));
    return respuesta.usuario;
  }

  // La manilla guardada (o null si no hay).
  get token(): string | null {
    return this.leer(CLAVE_TOKEN);
  }

  // Los datos de quien inició sesión (o null si no hay sesión).
  get usuario(): UsuarioSesion | null {
    const texto = this.leer(CLAVE_USUARIO);
    if (!texto) return null;
    try {
      return JSON.parse(texto) as UsuarioSesion;
    } catch {
      return null;
    }
  }

  // Dice si hay una sesión con la manilla todavía vigente.
  // Es solo una comodidad: el que decide de verdad si la manilla vale es el backend.
  sesionActiva(): boolean {
    const token = this.token;
    return !!token && !!this.usuario && this.tokenVigente(token);
  }

  // Borra la sesión y lleva al login.
  cerrarSesion(): void {
    this.borrar(CLAVE_TOKEN);
    this.borrar(CLAVE_USUARIO);
    this.router.navigateByUrl('/login', { replaceUrl: true });
  }

    // Dice a qué panel va cada rol al entrar a la app.
  rutaInicio(rol: RolUsuario): string {
    return rol === 'administrador' ? '/admin' : '/empleado';
  }

  // Mira la fecha de vencimiento que viene escrita dentro de la manilla.
  private tokenVigente(token: string): boolean {
    try {
      const cuerpo = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const datos = JSON.parse(atob(cuerpo));
      return typeof datos.exp === 'number' && datos.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }

  // Leer, guardar y borrar en el dispositivo, sin que un fallo tumbe la app.
  private leer(clave: string): string | null {
    try {
      return localStorage.getItem(clave);
    } catch {
      return null;
    }
  }

  private guardar(clave: string, valor: string): void {
    try {
      localStorage.setItem(clave, valor);
    } catch {
      // Si el dispositivo no deja guardar, la sesión solo durará hasta cerrar la app.
    }
  }

  private borrar(clave: string): void {
    try {
      localStorage.removeItem(clave);
    } catch {
      // Nada que hacer.
    }
  }
}