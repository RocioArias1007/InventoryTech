import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../configuracion';

export interface PuntoSerie { dia: string; unidades: number; }

export interface ResultadoDemanda {
  producto: { id_producto: number; nombre: string };
  desde: string;
  hasta: string;
  dias: number;
  unidades_vendidas: number;
  demanda_trapecio: number | null;
  serie: PuntoSerie[];
  nota?: string;
}

export interface ProductoSimple { id_producto: number; nombre: string; }

@Injectable({ providedIn: 'root' })
export class DemandaService {
  private http = inject(HttpClient);

  productos(): Observable<{ productos: ProductoSimple[] }> {
    return this.http.get<{ productos: ProductoSimple[] }>(`${API_URL}/productos`);
  }

  calcular(producto: number, desde: string, hasta: string): Observable<ResultadoDemanda> {
    const params = new HttpParams()
      .set('producto', producto)
      .set('desde', desde)
      .set('hasta', hasta);
    return this.http.get<ResultadoDemanda>(`${API_URL}/demanda`, { params });
  }
}