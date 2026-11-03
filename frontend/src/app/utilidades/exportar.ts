import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import writeXlsxFile from 'write-excel-file/universal';
import type { SheetData } from 'write-excel-file/universal';

// Datos que necesita un reporte para salir en PDF.
export interface DatosReporte {
  titulo: string; // Ejemplo: "Historial de ventas"
  subtitulo?: string; // Ejemplo: "Del 01/11/2026 al 02/11/2026"
  columnas: string[];
  filas: (string | number)[][];
  resumen?: { etiqueta: string; valor: string | number }[]; // Ejemplo: Total vendido
}

const quitarRarezas = (nombre: string) => nombre.replace(/[^\w\-]+/g, '_');

function blobABase64(blob: Blob): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(String(lector.result).split(',')[1]);
    lector.onerror = () => rechazar(lector.error);
    lector.readAsDataURL(blob);
  });
}

// En el celular guarda el archivo y abre el menú "Compartir" de Android.
async function compartirEnCelular(archivo: string, base64: string, titulo: string) {
  try {
    const guardado = await Filesystem.writeFile({ path: archivo, data: base64, directory: Directory.Cache });
    await Share.share({ title: titulo, url: guardado.uri, dialogTitle: 'Guardar o enviar' });
  } catch {
    // Si la persona cierra el menú de compartir, no pasa nada.
  }
}

function descargarEnNavegador(blob: Blob, archivo: string) {
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(blob);
  enlace.download = archivo;
  enlace.click();
  URL.revokeObjectURL(enlace.href);
}

// Exporta una tabla como archivo de Excel (.xlsx).
export async function exportarExcel(nombre: string, columnas: string[], filas: (string | number)[][]) {
  const encabezado = columnas.map((c) => ({ value: c, fontWeight: 'bold' as const }));
  const cuerpo = filas.map((fila) =>
    fila.map((v) => (typeof v === 'number' ? { value: v, type: Number } : { value: String(v ?? ''), type: String }))
  );
  const datos = [encabezado, ...cuerpo] as SheetData;

  const blob = await writeXlsxFile(datos, {
    columns: columnas.map(() => ({ width: 20 })),
    sheet: 'Reporte'
  }).toBlob();

  const archivo = `${quitarRarezas(nombre)}.xlsx`;
  if (Capacitor.isNativePlatform()) {
    await compartirEnCelular(archivo, await blobABase64(blob), nombre);
  } else {
    descargarEnNavegador(blob, archivo);
  }
}

// Mantiene el nombre antiguo para no tener que cambiar las pantallas que ya lo usan.
export const descargarCsv = exportarExcel;

// Genera el reporte en PDF. En el computador lo abre en una pestaña nueva; en el celular abre "Compartir".
export async function imprimir(datos: DatosReporte) {
  const horizontal = datos.columnas.length > 6;
  const doc = new jsPDF({ orientation: horizontal ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
  const margen = 40;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 41, 71);
  doc.setFontSize(18);
  doc.text('InventoryTech', margen, 46);
  doc.setFontSize(14);
  doc.text(datos.titulo, margen, 70);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  let y = 86;
  if (datos.subtitulo) {
    doc.text(datos.subtitulo, margen, y);
    y += 14;
  }
  doc.text(`Generado: ${new Date().toLocaleString('es-CO')}`, margen, y);
  y += 16;

  for (const linea of datos.resumen ?? []) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 41, 71);
    doc.text(`${linea.etiqueta}: ${linea.valor}`, margen, y);
    y += 14;
  }

  autoTable(doc, {
    startY: y + 6,
    head: [datos.columnas],
    body: datos.filas.map((f) => f.map((v) => String(v ?? ''))),
    theme: 'striped',
    headStyles: { fillColor: [22, 41, 71], textColor: 255 },
    styles: { fontSize: 9, cellPadding: 4 },
    margin: { left: margen, right: margen }
  });

  // Número de página abajo en cada hoja.
  const total = doc.getNumberOfPages();
  const ancho = doc.internal.pageSize.getWidth();
  const alto = doc.internal.pageSize.getHeight();
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.text(`Página ${i} de ${total}`, ancho - margen, alto - 20, { align: 'right' });
  }

  const archivo = `${quitarRarezas(datos.titulo)}.pdf`;
  if (Capacitor.isNativePlatform()) {
    const base64 = doc.output('datauristring').split('base64,')[1];
    await compartirEnCelular(archivo, base64, datos.titulo);
  } else {
    const url = String(doc.output('bloburl'));
    if (!window.open(url, '_blank')) {
      doc.save(archivo);
    }
  }
}

// Datos de un ticket de venta. Los valores en pesos llegan ya escritos como texto.
export interface DatosTicket {
  numero: number;
  fecha: string;
  vendedor: string;
  items: { nombre: string; detalle: string; total: string }[]; // detalle: "2 un. x $5.000"
  subtotal: string;
  iva: string;
  total: string;
  efectivo?: string;
  cambio?: string;
}

// Genera el ticket en PDF angosto (como un tiquete de caja). En el celular abre "Compartir".
export async function imprimirTicket(t: DatosTicket) {
  const ancho = 226; // 80 mm
  const margen = 12;
  const medida = new jsPDF({ unit: 'pt', format: [ancho, 400] });
  const nombresPartidos = t.items.map((i) => medida.splitTextToSize(i.nombre, ancho - margen * 2 - 70) as string[]);
  const lineasItems = nombresPartidos.reduce((suma, n) => suma + n.length + 1, 0);
  const alto = 150 + lineasItems * 12 + (t.efectivo !== undefined ? 30 : 0) + 60;

  const doc = new jsPDF({ unit: 'pt', format: [ancho, alto] });
  const derecha = ancho - margen;
  let y = 24;

  doc.setFont('courier', 'bold');
  doc.setFontSize(14);
  doc.text('InventoryTech', ancho / 2, y, { align: 'center' });
  y += 16;
  doc.setFont('courier', 'normal');
  doc.setFontSize(9);
  doc.text(`Ticket No. ${t.numero}`, ancho / 2, y, { align: 'center' });
  y += 12;
  doc.text(t.fecha, ancho / 2, y, { align: 'center' });
  y += 12;
  doc.text(`Atendió: ${t.vendedor}`, ancho / 2, y, { align: 'center' });
  y += 10;
  doc.setLineDashPattern([2, 2], 0);
  doc.line(margen, y, derecha, y);
  y += 14;

  t.items.forEach((item, i) => {
    nombresPartidos[i].forEach((linea, k) => {
      doc.text(linea, margen, y);
      if (k === 0) doc.text(item.total, derecha, y, { align: 'right' });
      y += 12;
    });
    doc.setFontSize(8);
    doc.text(item.detalle, margen, y);
    doc.setFontSize(9);
    y += 12;
  });

  doc.line(margen, y - 4, derecha, y - 4);
  y += 10;
  const fila = (etiqueta: string, valor: string, negrita = false) => {
    doc.setFont('courier', negrita ? 'bold' : 'normal');
    doc.setFontSize(negrita ? 11 : 9);
    doc.text(etiqueta, margen, y);
    doc.text(valor, derecha, y, { align: 'right' });
    y += negrita ? 16 : 12;
  };
  fila('Subtotal', t.subtotal);
  fila('IVA', t.iva);
  fila('TOTAL', t.total, true);
  if (t.efectivo !== undefined) {
    fila('Efectivo', t.efectivo);
    fila('Cambio', t.cambio ?? '');
  }
  doc.setFont('courier', 'normal');
  doc.setFontSize(9);
  y += 6;
  doc.text('¡Gracias por su compra!', ancho / 2, y, { align: 'center' });

  const archivo = `ticket-${t.numero}.pdf`;
  if (Capacitor.isNativePlatform()) {
    const base64 = doc.output('datauristring').split('base64,')[1];
    await compartirEnCelular(archivo, base64, `Ticket ${t.numero}`);
  } else {
    const url = String(doc.output('bloburl'));
    if (!window.open(url, '_blank')) {
      doc.save(archivo);
    }
  }
}