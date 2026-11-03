// ============================================================
// errores.ts
// Convierte los errores del backend en mensajes que entienda el tendero.
// ============================================================

import { HttpErrorResponse } from '@angular/common/http';

export function mensajeDeError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    // Estado 0 significa que el pedido ni siquiera llegó al backend.
    if (error.status === 0) {
      return 'No se pudo conectar con el servidor. Revisa tu conexión.';
    }
    // Si el backend mandó un mensaje, lo mostramos tal cual.
    const mensaje = error.error?.mensaje;
    if (typeof mensaje === 'string' && mensaje) {
      return mensaje;
    }
  }
  return 'Ocurrió un error inesperado. Intenta de nuevo.';
}