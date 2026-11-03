import { Component, inject, signal } from '@angular/core';
import { NavController, AlertController } from '@ionic/angular';
import { IonContent, IonInput, IonButton, IonIcon, IonSpinner } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { add, personCircle, searchOutline } from 'ionicons/icons';
import { CabeceraInternaComponent } from '../componentes/cabecera-interna/cabecera-interna.component';
import { UsuarioService, Usuario } from '../servicios/usuario.service';
import { AvisoService } from '../servicios/aviso.service';
import { mensajeDeError } from '../utilidades/errores';
import { addCircleOutline, create, person, search, trash } from 'ionicons/icons';
// ...
addIcons({ addCircleOutline, create, person, search, trash });

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [IonContent, IonInput, IonButton, IonIcon, IonSpinner, CabeceraInternaComponent],
  templateUrl: './usuarios.page.html',
  styleUrls: ['./usuarios.page.scss'],
})
export class UsuariosPage {
  private servicio = inject(UsuarioService);
  private nav = inject(NavController);
  private alertas = inject(AlertController);
  private aviso = inject(AvisoService);

  lista = signal<Usuario[]>([]);
  cargando = signal(true);
  errorCarga = signal('');

  private buscar = '';
  private temporizador: any;
  private numeroPeticion = 0;

  constructor() {
    addIcons({ add, personCircle, searchOutline });
  }

  ionViewWillEnter() {
    this.cargar();
  }

  cargar() {
    const numero = ++this.numeroPeticion;
    this.cargando.set(true);
    this.errorCarga.set('');
    this.servicio.listar(this.buscar).subscribe({
      next: (r) => {
        if (numero !== this.numeroPeticion) return;
        this.lista.set(r.usuarios);
        this.cargando.set(false);
      },
      error: (e) => {
        if (numero !== this.numeroPeticion) return;
        this.errorCarga.set(mensajeDeError(e));
        this.cargando.set(false);
      },
    });
  }

  alEscribir(evento: any) {
    this.buscar = evento.detail.value ?? '';
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => this.cargar(), 300);
  }

  nuevo() {
    this.nav.navigateForward('/usuarios/nuevo');
  }

  editar(u: Usuario) {
    this.nav.navigateForward(`/usuarios/${u.id_usuario}/editar`);
  }

  async eliminar(u: Usuario) {
    const alerta = await this.alertas.create({
      header: 'Eliminar usuario',
      message: `¿Eliminar a ${u.nombre} ${u.apellidos}? Ya no podrá iniciar sesión.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: () => {
            this.servicio.eliminar(u.id_usuario).subscribe({
              next: (r) => {
                this.aviso.mostrar(r.mensaje, 'success');
                this.cargar();
              },
              error: (e) => this.aviso.mostrar(mensajeDeError(e), 'danger'),
            });
          },
        },
      ],
    });
    await alerta.present();
  }
}