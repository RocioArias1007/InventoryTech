import { Component, ViewChild, inject, signal } from '@angular/core';
import { IonContent, IonFooter, IonHeader, IonIcon, IonInput } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { send, trash } from 'ionicons/icons';
import { CabeceraInternaComponent } from '../componentes/cabecera-interna/cabecera-interna.component';
import { ChatService } from '../servicios/chat.service';
import { SesionService } from '../servicios/sesion.service';
import { mensajeDeError } from '../utilidades/errores';

interface Mensaje {
  de: 'usuario' | 'katia';
  texto: string;
  error?: boolean;
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [IonContent, IonFooter, IonHeader, IonIcon, IonInput, CabeceraInternaComponent],
  templateUrl: './chat.page.html',
  styleUrls: ['./chat.page.scss'],
})
export class ChatPage {
  @ViewChild(IonContent) contenido?: IonContent;

  private servicio = inject(ChatService);
  private sesion = inject(SesionService);

  mensajes = signal<Mensaje[]>([]);
  escrito = signal('');
  esperando = signal(false);

  rutaInicio = '/admin';
  sugerencias: string[] = [];

  constructor() {
    addIcons({ send, trash });

    // Funciona tanto si "usuario" es una función como si es una propiedad.
    const u: any = typeof this.sesion.usuario === 'function' ? (this.sesion.usuario as any)() : this.sesion.usuario;
    const esAdmin = u?.rol === 'administrador';

    this.rutaInicio = esAdmin ? '/admin' : '/empleado';

    if (esAdmin) {
      this.mensajes.set([
        {
          de: 'katia',
          texto: 'Hola, soy Katia. Pregúntame por existencias, precios, ventas, productos más vendidos, demanda o costos de compra.',
        },
      ]);
      this.sugerencias = [
        '¿Qué productos están por agotarse?',
        '¿Cuánto vendí hoy?',
        '¿Cuáles fueron los más vendidos esta semana?',
      ];
    } else {
      this.mensajes.set([
        {
          de: 'katia',
          texto: 'Hola, soy Katia. Pregúntame cuántas unidades quedan de un producto y a cómo se vende.',
        },
      ]);
      this.sugerencias = ['¿Qué productos están por agotarse?'];
    }
  }

  enviar(texto?: string) {
    const pregunta = (texto ?? this.escrito()).trim();
    if (!pregunta || this.esperando()) return;

    this.escrito.set('');
    this.mensajes.update((lista) => [...lista, { de: 'usuario', texto: pregunta }]);
    this.esperando.set(true);
    this.bajar();

    this.servicio.preguntar(pregunta).subscribe({
      next: (r) => {
        this.mensajes.update((lista) => [...lista, { de: 'katia', texto: this.limpiar(r.respuesta) }]);
        this.esperando.set(false);
        this.bajar();
      },
      error: (e) => {
        this.mensajes.update((lista) => [...lista, { de: 'katia', texto: mensajeDeError(e), error: true }]);
        this.esperando.set(false);
        this.bajar();
      },
    });
  }

      // Borra la conversación y deja solo el saludo de Katia (el primer mensaje).
  borrarConversacion(): void {
    this.mensajes.set(this.mensajes().slice(0, 1));
    this.escrito.set('');
  }

  // Quita los asteriscos de formato por si Gemini los trae.
  private limpiar(texto: string): string {
    return texto.replace(/\*\*/g, '').trim();
  }

  private bajar() {
    setTimeout(() => this.contenido?.scrollToBottom(250), 50);
  }
}