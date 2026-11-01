// ============================================================
// categoria-form.page.ts
// Pantalla para crear una categoría nueva o actualizar una existente.
// Si la dirección trae un número (/categorias/5/editar), es para actualizar.
// ============================================================

import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonInput,
  IonSpinner,
  IonTextarea,
  NavController,
} from '@ionic/angular';
import { CabeceraInternaComponent } from '../componentes/cabecera-interna/cabecera-interna.component';
import { AvisoService } from '../servicios/aviso.service';
import { CategoriaService } from '../servicios/categoria.service';
import { mensajeDeError } from '../utilidades/errores';

@Component({
  selector: 'app-categoria-form',
  templateUrl: 'categoria-form.page.html',
  imports: [
    FormsModule,
    IonButton,
    IonContent,
    IonInput,
    IonSpinner,
    IonTextarea,
    CabeceraInternaComponent,
  ],
  standalone: true,
})
export class CategoriaFormPage implements OnInit {
  private servicio = inject(CategoriaService);
  private aviso = inject(AvisoService);
  private nav = inject(NavController);
  private textoId = inject(ActivatedRoute).snapshot.paramMap.get('id');

  // Si la dirección trae un número, estamos actualizando; si no, creando.
  editando = this.textoId !== null;
  private id = this.editando ? Number(this.textoId) : 0;
  titulo = this.editando ? 'Actualizar Categoría' : 'Nueva Categoría';
  textoBoton = this.editando ? 'Guardar Cambios' : 'Guardar Categoría';

  // Lo que la persona escribe.
  nombre = '';
  descripcion = '';

  // Estados de la pantalla.
  cargandoDatos = signal(this.editando);
  guardando = signal(false);
  mensajeError = signal('');

  ngOnInit(): void {
    if (this.editando) {
      this.cargarDatos();
    }
  }

  // Al actualizar, busca la categoría para llenar los campos.
  private async cargarDatos(): Promise<void> {
    if (!Number.isInteger(this.id) || this.id < 1) {
      this.salirConAviso('La categoría no existe.');
      return;
    }
    try {
      const todas = await this.servicio.listar();
      const categoria = todas.find((c) => c.id_categoria === this.id);
      if (!categoria) {
        this.salirConAviso('La categoría no existe.');
        return;
      }
      this.nombre = categoria.nombre;
      this.descripcion = categoria.descripcion ?? '';
      this.cargandoDatos.set(false);
    } catch (error) {
      this.salirConAviso(mensajeDeError(error));
    }
  }

  // Avisa el problema y vuelve a la lista.
  private salirConAviso(mensaje: string): void {
    this.aviso.mostrar(mensaje, 'danger');
    this.nav.navigateBack('/categorias');
  }

  // Revisa los campos, guarda en el backend y vuelve a la lista.
  async guardar(): Promise<void> {
    if (this.guardando()) return;

    const nombre = this.nombre.trim();
    if (!nombre) {
      this.mensajeError.set('El nombre de la categoría es obligatorio.');
      return;
    }

    this.guardando.set(true);
    this.mensajeError.set('');
    try {
      const datos = { nombre, descripcion: this.descripcion.trim() };
      const respuesta = this.editando
        ? await this.servicio.actualizar(this.id, datos)
        : await this.servicio.crear(datos);
      this.aviso.mostrar(respuesta.mensaje, 'success');
      await this.nav.navigateBack('/categorias');
    } catch (error) {
      this.mensajeError.set(mensajeDeError(error));
    } finally {
      this.guardando.set(false);
    }
  }
}