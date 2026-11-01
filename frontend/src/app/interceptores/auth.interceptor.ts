// ============================================================
// auth.interceptor.ts
// Le pone la manilla (token) a cada pedido que va al backend.
// Si el backend dice que la manilla ya no sirve, cierra la sesión.
// ============================================================

import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { API_URL } from '../configuracion';
import { SesionService } from '../servicios/sesion.service';

export const authInterceptor: HttpInterceptorFn = (peticion, siguiente) => {
  const sesion = inject(SesionService);

  // Solo tocamos los pedidos que van a nuestro backend.
  if (!peticion.url.startsWith(API_URL)) {
    return siguiente(peticion);
  }

  // Si hay manilla, se agrega al encabezado del pedido.
  const token = sesion.token;
  const conToken = token
    ? peticion.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : peticion;

  return siguiente(conToken).pipe(
    catchError((error: unknown) => {
      // El 401 del propio login significa "clave incorrecta", no "sesión vencida".
      const esLogin = peticion.url === `${API_URL}/auth/login`;
      if (error instanceof HttpErrorResponse && error.status === 401 && !esLogin) {
        sesion.cerrarSesion();
      }
      return throwError(() => error);
    })
  );
};