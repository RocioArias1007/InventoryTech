import { Component, OnInit, input, output, signal } from '@angular/core';
import { IonButton } from '@ionic/angular';

function textoFecha(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

@Component({
  selector: 'app-filtro-fechas',
  standalone: true,
  imports: [IonButton],
  template: `
    <div class="filtro">
      <div class="dos-columnas">
        <div>
          <label class="etiqueta-campo">Desde</label>
          <input type="date" class="campo-form campo-fecha" [value]="desde()" [max]="hoy"
            (input)="desde.set($any($event.target).value)" />
        </div>
        <div>
          <label class="etiqueta-campo">Hasta</label>
          <input type="date" class="campo-form campo-fecha" [value]="hasta()" [max]="hoy"
            (input)="hasta.set($any($event.target).value)" />
        </div>
      </div>
      @if (error()) {
        <p class="mensaje-error">{{ error() }}</p>
      }
      <ion-button expand="block" class="boton-guardar azul" [disabled]="cargando()" (click)="aplicar()">
        {{ cargando() ? 'Consultando...' : 'Consultar' }}
      </ion-button>
    </div>
  `,
  styles: [`
    .filtro { padding: 0 16px; }
    .dos-columnas { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .campo-fecha {
      width: 100%;
      min-height: 48px;
      padding: 0 10px;
      font-family: inherit;
      font-size: 15px;
      color: var(--it-texto-oscuro);
      box-sizing: border-box;
    }
  `],
})
export class FiltroFechasComponent implements OnInit {
  cargando = input(false);
  buscar = output<{ desde: string; hasta: string }>();

  desde = signal('');
  hasta = signal('');
  error = signal('');
  hoy = textoFecha(new Date());

  ngOnInit() {
    const fin = new Date();
    const inicio = new Date();
    inicio.setDate(inicio.getDate() - 6);
    this.hasta.set(textoFecha(fin));
    this.desde.set(textoFecha(inicio));
    // Consulta una vez con los últimos 7 días.
    setTimeout(() => this.aplicar());
  }

  aplicar() {
    this.error.set('');
    if (!this.desde() || !this.hasta()) {
      this.error.set('Elige las dos fechas.');
      return;
    }
    if (this.desde() > this.hasta()) {
      this.error.set('La fecha "Desde" no puede ser posterior a "Hasta".');
      return;
    }
    this.buscar.emit({ desde: this.desde(), hasta: this.hasta() });
  }
}