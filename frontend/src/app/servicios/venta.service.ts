// ============================================================
// venta.service.ts
// Manda una venta al backend. El precio nunca se envía: lo lee el backend.
// ============================================================

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../configuracion';

export interface ItemVenta {
  id_producto: number;
  cantidad: number;
}

export interface VentaRegistrada {
  id_venta: number;
  fecha_venta: string;
  vendedor: string;
  items: { id_producto: number; nombre: string; cantidad: number; precio_und: number; total: number }[];
  subtotal: number;
  iva_total: number;
  total: number;
  efectivo_recibido?: number;
  cambio?: number;
}

export interface AlertaStock {
  id_producto: number;
  nombre: string;
  cantidad: number;
  stock_minimo: number;
  estado: string;
}

export interface RespuestaVenta {
  mensaje: string;
  venta: VentaRegistrada;
  // Solo la recibe el administrador.
  alertas_stock_bajo?: AlertaStock[];
}

@Injectable({ providedIn: 'root' })
export class VentaService {
  private http = inject(HttpClient);

  // Registra la venta. El efectivo recibido es opcional.
  registrar(items: ItemVenta[], efectivoRecibido?: number): Promise<RespuestaVenta> {
    const cuerpo: { items: ItemVenta[]; efectivo_recibido?: number } = { items };
    if (efectivoRecibido !== undefined) {
      cuerpo.efectivo_recibido = efectivoRecibido;
    }
    return firstValueFrom(this.http.post<RespuestaVenta>(`${API_URL}/ventas`, cuerpo));
  }
}