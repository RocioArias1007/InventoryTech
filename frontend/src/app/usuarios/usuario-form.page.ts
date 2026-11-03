import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NavController } from '@ionic/angular';
import { IonContent, IonInput, IonButton, IonSpinner, IonSelect, IonSelectOption } from '@ionic/angular';
import { CabeceraInternaComponent } from '../componentes/cabecera-interna/cabecera-interna.component';
import { UsuarioService, Rol, DatosUsuario } from '../servicios/usuario.service';
import { SesionService } from '../servicios/sesion.service';
import { AvisoService } from '../servicios/aviso.service';
import { mensajeDeError } from '../utilidades/errores';

@Component({
  selector: 'app-usuario-form',
  standalone: true,
  imports: [IonContent, IonInput, IonButton, IonSpinner, IonSelect, IonSelectOption, CabeceraInternaComponent],
  templateUrl: './usuario-form.page.html',
    styles: [`
    .dos-columnas { display: grid; grid-template-columns: 1fr 1fr; column-gap: 12px; }
    ion-select { --padding-start: 0; --padding-end: 0; min-height: 48px; --color: var(--it-texto-oscuro); }
    .ayuda { margin: -2px 0 6px; font-size: 12px; color: var(--it-texto-suave); }
  `],
})
export class UsuarioFormPage {
  private servicio = inject(UsuarioService);
  private ruta = inject(ActivatedRoute);
  private nav = inject(NavController);
  private sesion = inject(SesionService);
  private aviso = inject(AvisoService);

  id = signal<number | null>(null);
  cargando = signal(false);
  guardando = signal(false);
  error = signal('');
  esMiUsuario = signal(false);

  nombre = signal('');
  apellidos = signal('');
  usuario = signal('');
  correo = signal('');
  contrasena = signal('');
  telefono = signal('');
  rol = signal<Rol>('empleado');

  ionViewWillEnter() {
    const param = this.ruta.snapshot.paramMap.get('id');
    this.error.set('');
    if (!param) {
      this.id.set(null);
      this.nombre.set(''); this.apellidos.set(''); this.usuario.set('');
      this.correo.set(''); this.contrasena.set(''); this.telefono.set('');
      this.rol.set('empleado');
      this.esMiUsuario.set(false);
      return;
    }
    const id = Number(param);
    this.id.set(id);
    this.cargando.set(true);
    this.servicio.listar().subscribe({
      next: (r) => {
        const u = r.usuarios.find((x) => x.id_usuario === id);
        if (!u) {
          this.aviso.mostrar('El usuario no existe.', 'danger');
          this.nav.navigateBack('/usuarios');
          return;
        }
        this.nombre.set(u.nombre);
        this.apellidos.set(u.apellidos);
        this.usuario.set(u.usuario);
        this.correo.set(u.correo ?? '');
        this.telefono.set(u.telefono ?? '');
        this.rol.set(u.rol);
        this.contrasena.set('');
        this.esMiUsuario.set(this.sesion.usuario?.id_usuario === id);
        this.cargando.set(false);
      },
      error: (e) => {
        this.error.set(mensajeDeError(e));
        this.cargando.set(false);
      },
    });
  }

  guardar() {
    this.error.set('');
    const editando = this.id() !== null;

    if (!this.nombre().trim() || !this.apellidos().trim() || !this.usuario().trim() || !this.correo().trim()) {
      this.error.set('Completa nombre, apellidos, usuario y correo.');
      return;
    }
    if (!editando && !this.contrasena()) {
      this.error.set('La contraseña es obligatoria.');
      return;
    }

    const datos: DatosUsuario = {
      nombre: this.nombre().trim(),
      apellidos: this.apellidos().trim(),
      usuario: this.usuario().trim(),
      correo: this.correo().trim(),
      telefono: this.telefono().trim(),
      rol: this.rol(),
    };
    if (this.contrasena()) datos.contrasena = this.contrasena();

    this.guardando.set(true);
    const peticion = editando
      ? this.servicio.actualizar(this.id()!, datos)
      : this.servicio.crear(datos);

    peticion.subscribe({
      next: (r) => {
        this.guardando.set(false);
        this.aviso.mostrar(r.mensaje, 'success');
        this.nav.navigateBack('/usuarios');
      },
      error: (e) => {
        this.guardando.set(false);
        this.error.set(mensajeDeError(e));
      },
    });
  }
}