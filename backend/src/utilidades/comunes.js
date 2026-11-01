// ============================================================
// comunes.js
// Funciones auxiliares que usan varios módulos del backend.
// ============================================================

// Convierte un valor a número. Acepta números y textos como "1500"
// (la app a veces los manda como texto). Si no es válido, devuelve null.
function aNumero(valor) {
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor;
  if (typeof valor === 'string' && valor.trim() !== '' && Number.isFinite(Number(valor))) {
    return Number(valor);
  }
  return null;
}

// Revisa que un número tenga máximo 2 decimales (como los pesos con centavos).
function maximoDosDecimales(numero) {
  return Math.abs(numero * 100 - Math.round(numero * 100)) < 1e-6;
}

// Dice si un dato opcional realmente llegó (no vino vacío ni ausente).
function vino(valor) {
  return valor !== undefined && valor !== null && valor !== '';
}

// Calcula el estado de stock de un producto: agotado, bajo o disponible.
function calcularEstado(cantidad, stockMinimo) {
  if (cantidad === 0) return 'agotado';
  if (cantidad <= stockMinimo) return 'bajo';
  return 'disponible';
}

// Revisa que un texto sea una fecha real con formato AAAA-MM-DD (por ejemplo 2026-10-12).
function esFechaValida(texto) {
  if (typeof texto !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const fecha = new Date(`${texto}T00:00:00Z`);
  // Si la fecha no existe (por ejemplo 2026-02-30), JavaScript la corrige y ya no coincide.
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === texto;
}

// Revisa el rango de fechas "desde" y "hasta" que llega en la dirección.
// Devuelve { error: 'mensaje' } si algo está mal,
// { sinFechas: true } si no enviaron ninguna,
// o { desde, hasta } si todo está bien.
function leerRangoFechas(query) {
  const { desde, hasta } = query;

  // O se envían las dos fechas, o ninguna.
  if ((desde === undefined) !== (hasta === undefined)) {
    return { error: 'Envía las dos fechas, "desde" y "hasta", o ninguna.' };
  }
  if (desde === undefined) {
    return { sinFechas: true };
  }

  // Las dos deben ser fechas reales con el formato correcto.
  if (!esFechaValida(desde) || !esFechaValida(hasta)) {
    return { error: 'Las fechas deben ser reales y tener el formato AAAA-MM-DD, por ejemplo 2026-10-12.' };
  }
  if (desde > hasta) {
    return { error: 'La fecha "desde" no puede ser posterior a "hasta".' };
  }

  // El rango no puede pasar de 366 días.
  const dias = (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000 + 1;
  if (dias > 366) {
    return { error: 'El rango no puede superar 366 días.' };
  }

  return { desde, hasta };
}

// Devuelve la fecha de hoy (AAAA-MM-DD) según la base de datos.
async function fechaDeHoy(pool) {
  const [filas] = await pool.query("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS hoy");
  return filas[0].hoy;
}

module.exports = {
  aNumero,
  maximoDosDecimales,
  vino,
  calcularEstado,
  esFechaValida,
  leerRangoFechas,
  fechaDeHoy
};