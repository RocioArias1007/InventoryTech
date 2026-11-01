// ============================================================
// app.routes.ts
// Las "direcciones" de la app y qué pantalla muestra cada una.
// Ojo: las dos últimas reglas ('' y '**') siempre van al final.
// ============================================================

import { Routes } from '@angular/router';
import { rolGuard, sesionGuard, sinSesionGuard } from './guardias/sesion.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [sinSesionGuard],
    loadComponent: () => import('./login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'admin',
    canActivate: [rolGuard('administrador')],
    loadComponent: () => import('./panel-admin/panel-admin.page').then((m) => m.PanelAdminPage),
  },
  {
    path: 'empleado',
    canActivate: [rolGuard('empleado')],
    loadComponent: () =>
      import('./panel-empleado/panel-empleado.page').then((m) => m.PanelEmpleadoPage),
  },
  // Categorías: solo el administrador.
  {
    path: 'categorias',
    canActivate: [rolGuard('administrador')],
    loadComponent: () => import('./categorias/categorias.page').then((m) => m.CategoriasPage),
  },
  {
    path: 'categorias/nueva',
    canActivate: [rolGuard('administrador')],
    loadComponent: () =>
      import('./categorias/categoria-form.page').then((m) => m.CategoriaFormPage),
  },
  {
    path: 'categorias/:id/editar',
    canActivate: [rolGuard('administrador')],
    loadComponent: () =>
      import('./categorias/categoria-form.page').then((m) => m.CategoriaFormPage),
  },
  // Usuarios: solo el administrador.
  {
    path: 'usuarios',
    canActivate: [rolGuard('administrador')],
    loadComponent: () => import('./usuarios/usuarios.page').then((m) => m.UsuariosPage),
  },
  {
    path: 'usuarios/nuevo',
    canActivate: [rolGuard('administrador')],
    loadComponent: () => import('./usuarios/usuario-form.page').then((m) => m.UsuarioFormPage),
  },
  {
    path: 'usuarios/:id/editar',
    canActivate: [rolGuard('administrador')],
    loadComponent: () => import('./usuarios/usuario-form.page').then((m) => m.UsuarioFormPage),
  },
  // Productos: solo el administrador.
  {
    path: 'productos',
    canActivate: [rolGuard('administrador')],
    loadComponent: () => import('./productos/productos.page').then((m) => m.ProductosPage),
  },
  {
    path: 'productos/nuevo',
    canActivate: [rolGuard('administrador')],
    loadComponent: () =>
      import('./productos/producto-form.page').then((m) => m.ProductoFormPage),
  },
  {
    path: 'productos/:id/editar',
    canActivate: [rolGuard('administrador')],
    loadComponent: () =>
      import('./productos/producto-form.page').then((m) => m.ProductoFormPage),
  },

    // Registrar venta: la misma pantalla para cada rol.
  {
    path: 'ventas',
    canActivate: [rolGuard('administrador')],
    loadComponent: () =>
      import('./ventas/registrar-venta.page').then((m) => m.RegistrarVentaPage),
  },
  {
    path: 'empleado/ventas',
    canActivate: [rolGuard('empleado')],
    loadComponent: () =>
      import('./ventas/registrar-venta.page').then((m) => m.RegistrarVentaPage),
  },

    // Consultar stock: solo el empleado, solo lectura.
  {
    path: 'empleado/stock',
    canActivate: [rolGuard('empleado')],
    loadComponent: () =>
      import('./productos/consultar-stock.page').then((m) => m.ConsultarStockPage),
  },

  {
  path: 'ventas-periodo',
  canActivate: [rolGuard('administrador')],
  loadComponent: () => import('./ventas-periodo/ventas-periodo.page').then((m) => m.VentasPeriodoPage),
  },

  {
  path: 'reportes',
  canActivate: [rolGuard('administrador')],
  loadComponent: () => import('./reportes/reportes.page').then((m) => m.ReportesPage),
},
{
  path: 'reportes/alertas-stock',
  canActivate: [rolGuard('administrador')],
  loadComponent: () => import('./reportes/alertas-stock.page').then((m) => m.AlertasStockPage),
},
{
  path: 'reportes/corte-caja',
  canActivate: [rolGuard('administrador')],
  loadComponent: () => import('./reportes/corte-caja.page').then((m) => m.CorteCajaPage),
},

{
  path: 'reportes/movimientos',
  canActivate: [rolGuard('administrador')],
  loadComponent: () => import('./reportes/movimientos.page').then((m) => m.MovimientosPage),
},
{
  path: 'reportes/historial-ventas',
  canActivate: [rolGuard('administrador')],
  loadComponent: () => import('./reportes/historial-ventas.page').then((m) => m.HistorialVentasPage),
},
{
  path: 'reportes/rentabilidad',
  canActivate: [rolGuard('administrador')],
  loadComponent: () => import('./reportes/rentabilidad.page').then((m) => m.RentabilidadPage),
},

{
  path: 'chat',
  canActivate: [sesionGuard],
  loadComponent: () => import('./chat/chat.page').then((m) => m.ChatPage),
},

  // Estas dos siempre al final.
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' },
];