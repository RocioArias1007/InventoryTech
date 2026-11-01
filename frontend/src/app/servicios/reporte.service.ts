// ============================================================
// reporte.service.ts
// Pide al backend los datos de los reportes.
// ============================================================

import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../configuracion';

export interface ProductoAlerta {
  id_producto: number;
  nombre: string;
  categoria: string;
  cantidad: number;
  stock_minimo: number;
  estado: 'agotado' | 'bajo';
}

export interface RespuestaStockBajo {
  total: number;
  agotados: number;
  bajos: number;
  productos: ProductoAlerta[];
}

export interface VentaResumen {
  id_venta: number;
  fecha_venta: string;
  vendedor: string;
  renglones: number;
  unidades: number;
  total: number;
}

export interface RespuestaVentas {
  desde: string;
  hasta: string;
  total_ventas: number;
  total_ingresos: number;
  mostrando: number;
  hay_mas: boolean;
  ventas: VentaResumen[];
}

// Los dos datos del panel del administrador.
export interface ResumenPanel {
  stock_bajo: { total: number; bajos: number; agotados: number };
  ventas_hoy: { fecha: string; total_ventas: number; total_ingresos: number };
  
}



@Injectable({ providedIn: 'root' })
export class ReporteService {
  private http = inject(HttpClient);

  // "Stock Bajo" y "Ventas Hoy" del panel del administrador.
  resumenPanel(): Promise<ResumenPanel> {
    return firstValueFrom(this.http.get<ResumenPanel>(`${API_URL}/reportes/resumen`));
  }

    stockBajo() {
    return this.http.get<RespuestaStockBajo>(`${API_URL}/reportes/stock-bajo`);
  }

  // Sin fechas, el backend devuelve las ventas de hoy.
  ventasDeHoy() {
    return this.http.get<RespuestaVentas>(`${API_URL}/ventas`);
  }

    movimientos(desde: string, hasta: string, tipo = '') {
    let params = new HttpParams().set('desde', desde).set('hasta', hasta);
    if (tipo) params = params.set('tipo', tipo);
    return this.http.get<RespuestaMovimientos>(`${API_URL}/historial/movimientos`, { params });
  }

  ventasPorRango(desde: string, hasta: string) {
    const params = new HttpParams().set('desde', desde).set('hasta', hasta);
    return this.http.get<RespuestaVentas>(`${API_URL}/ventas`, { params });
  }

  rentabilidad(desde: string, hasta: string) {
    const params = new HttpParams().set('desde', desde).set('hasta', hasta);
    return this.http.get<RespuestaRentabilidad>(`${API_URL}/reportes/rentabilidad`, { params });
  }
}

export interface Movimiento {
  id_movimiento: number;
  fecha: string;
  tipo: 'ingreso' | 'venta' | 'ajuste';
  cantidad: number;
  stock_anterior: number;
  stock_nuevo: number;
  id_producto: number;
  producto: string;
  usuario: string;
}

export interface RespuestaMovimientos {
  desde: string;
  hasta: string;
  total_movimientos: number;
  unidades_ingreso: number;
  unidades_venta: number;
  mostrando: number;
  hay_mas: boolean;
  movimientos: Movimiento[];
}

export interface CifrasRentabilidad {
  unidades: number;
  ingresos: number;
  iva: number;
  ingresos_sin_iva: number;
  costo: number;
  ganancia: number;
  margen_porcentaje: number | null;
}

export interface ProductoRentabilidad extends CifrasRentabilidad {
  id_producto: number;
  nombre: string;
}

export interface RespuestaRentabilidad {
  desde: string;
  hasta: string;
  resumen: CifrasRentabilidad;
  productos: ProductoRentabilidad[];
}

