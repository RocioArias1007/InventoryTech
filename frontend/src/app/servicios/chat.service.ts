import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../configuracion';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private http = inject(HttpClient);

  preguntar(mensaje: string): Observable<{ respuesta: string }> {
    return this.http.post<{ respuesta: string }>(`${API_URL}/chat`, { mensaje });
  }
}