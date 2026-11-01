// ============================================================
// login.page.ts
// Pantalla de inicio de sesión.
// ============================================================

import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonButton, IonContent, IonIcon, IonInput, IonSpinner } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { eye, eyeOff, lockClosed, person } from 'ionicons/icons';
import { SesionService } from '../servicios/sesion.service';
import { mensajeDeError } from '../utilidades/errores';

@Component({
  selector: 'app-login',
  templateUrl: 'login.page.html',
  styleUrls: ['login.page.scss'],
  imports: [FormsModule, IonButton, IonContent, IonIcon, IonInput, IonSpinner],
  standalone: true,
})
export class LoginPage {
  private sesion = inject(SesionService);
  private router = inject(Router);

  // Lo que la persona escribe en los dos campos.
  usuario = '';
  contrasena = '';

  // Estados de la pantalla (cajitas que avisan cuando cambian).
  mostrarClave = signal(false);
  cargando = signal(false);
  mensajeError = signal('');

  constructor() {
    // Registra los iconos que usa esta pantalla.
    addIcons({ eye, eyeOff, lockClosed, person });
  }

  // Muestra u oculta la contraseña (el ojito).
  alternarClave(): void {
    this.mostrarClave.update((valor) => !valor);
  }

  // Revisa los campos, envía los datos al backend y entra a la app.
  async ingresar(): Promise<void> {
    if (this.cargando()) return;

    const usuario = this.usuario.trim();
    if (!usuario || !this.contrasena) {
      this.mensajeError.set('Escribe tu usuario y tu contraseña.');
      return;
    }

    this.cargando.set(true);
    this.mensajeError.set('');
    try {
      const usuarioSesion = await this.sesion.iniciarSesion(usuario, this.contrasena);
      // Cada rol va a su propio panel.
      await this.router.navigateByUrl(this.sesion.rutaInicio(usuarioSesion.rol), { replaceUrl: true });
    } catch (error) {
      this.mensajeError.set(mensajeDeError(error));
    } finally {
      this.cargando.set(false);
    }
  }
}