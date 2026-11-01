// ============================================================
// sesion.guard.ts
// Los porteros de las pantallas.
// ============================================================

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { RolUsuario, SesionService } from '../servicios/sesion.service';

// Para pantallas que pueden usar los dos roles: pide tener la sesión iniciada.
export const sesionGuard: CanActivateFn = () => {
  const sesion = inject(SesionService);
  if (sesion.sesionActiva()) {
    return true;
  }
  return inject(Router).createUrlTree(['/login']);
};

// Para pantallas de un solo rol. Si no hay sesión, va al login.
// Si hay sesión de otro rol, lo manda a su propio panel.
export function rolGuard(rolPermitido: RolUsuario): CanActivateFn {
  return () => {
    const sesion = inject(SesionService);
    const router = inject(Router);
    const usuario = sesion.usuario;

    if (!sesion.sesionActiva() || !usuario) {
      return router.createUrlTree(['/login']);
    }
    if (usuario.rol === rolPermitido) {
      return true;
    }
    return router.createUrlTree([sesion.rutaInicio(usuario.rol)]);
  };
}

// Para el login: si ya hay una sesión iniciada, no lo muestra y lleva al panel de ese rol.
export const sinSesionGuard: CanActivateFn = () => {
  const sesion = inject(SesionService);
  const usuario = sesion.usuario;

  if (sesion.sesionActiva() && usuario) {
    return inject(Router).createUrlTree([sesion.rutaInicio(usuario.rol)]);
  }
  return true;
};