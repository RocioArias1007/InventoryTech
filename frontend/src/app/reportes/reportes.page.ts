import { Component, inject } from '@angular/core';
import { NavController } from '@ionic/angular';
import { IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { swapVertical, statsChart, calculator, warning, trendingUp, arrowForward } from 'ionicons/icons';
import { CabeceraInternaComponent } from '../componentes/cabecera-interna/cabecera-interna.component';
import { AvisoService } from '../servicios/aviso.service';

interface Reporte {
  icono: string;
  titulo: string;
  descripcion: string;
  color: string;
  fondo: string;
  ruta?: string;
}

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [IonContent, IonIcon, CabeceraInternaComponent],
  templateUrl: './reportes.page.html',
  styleUrls: ['./reportes.page.scss'],
})
export class ReportesPage {
  private nav = inject(NavController);
  private aviso = inject(AvisoService);

  reportes: Reporte[] = [
    {
      icono: 'swap-vertical',
      titulo: 'Movimientos de Inventario',
      descripcion: 'Entradas y salidas de mercancía por fecha',
      color: '#2563eb',
      fondo: '#dbeafe',
      ruta: '/reportes/movimientos',
    },
    {
      icono: 'stats-chart',
      titulo: 'Historial General de Ventas',
      descripcion: 'Consolidado total de ingresos por período',
      color: '#059669',
      fondo: '#d1fae5',
      ruta: '/reportes/historial-ventas',
    },
    {
      icono: 'calculator',
      titulo: 'Corte y Cierre de Caja',
      descripcion: 'Dinero recibido y balance de caja del día',
      color: '#d97706',
      fondo: '#fef3c7',
      ruta: '/reportes/corte-caja',
    },
    {
      icono: 'warning',
      titulo: 'Alertas de Stock Bajo',
      descripcion: 'Productos próximos a agotarse en inventario',
      color: '#dc2626',
      fondo: '#fee2e2',
      ruta: '/reportes/alertas-stock',
    },
    {
      icono: 'trending-up',
      titulo: 'Rentabilidad',
      descripcion: 'Lo vendido, lo que costó y lo ganado',
      color: '#0d9488',
      fondo: '#ccfbf1',
      ruta: '/reportes/rentabilidad',
    },
  ];

  constructor() {
    addIcons({ swapVertical, statsChart, calculator, warning, trendingUp, arrowForward });
  }

  abrir(r: Reporte) {
    if (r.ruta) {
      this.nav.navigateForward(r.ruta);
    } else {
      this.aviso.mostrar('Este reporte se construye en el próximo paso.', 'warning');
    }
  }
}