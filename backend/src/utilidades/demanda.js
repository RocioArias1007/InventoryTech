// ============================================================
// demanda.js
// Cálculo de la demanda de un producto con la regla del trapecio.
// Lo usa el pedido GET /api/demanda y, más adelante, el chatbot.
// ============================================================

// La conexión a MySQL.
const pool = require('../config/baseDatos');

// Milisegundos que tiene un día (para recorrer las fechas de una en una).
const MS_POR_DIA = 86400000;

// Calcula la demanda de un producto entre dos fechas (ambas incluidas).
// Devuelve null si el producto no existe.
async function calcularDemanda(idProducto, desde, hasta) {
  // 1. Busca el producto (también si fue eliminado, porque su historial se conserva).
  const [productos] = await pool.query(
    'SELECT id_producto, nombre FROM producto WHERE id_producto = ?',
    [idProducto]
  );
  if (productos.length === 0) return null;

  // 2. Suma las unidades vendidas en cada día del rango.
  const [filas] = await pool.query(
    `SELECT DATE_FORMAT(v.fecha_venta, '%Y-%m-%d') AS dia, SUM(d.cantidad) AS unidades
     FROM detalle_venta d
     JOIN cabecera_venta v ON v.id_venta = d.id_venta
     WHERE d.id_producto = ?
       AND v.fecha_venta >= ?
       AND v.fecha_venta < DATE_ADD(CAST(? AS DATE), INTERVAL 1 DAY)
     GROUP BY DATE_FORMAT(v.fecha_venta, '%Y-%m-%d')`,
    [idProducto, desde, hasta]
  );

  // Guarda "día -> unidades" para buscar rápido.
  const porDia = new Map(filas.map((fila) => [fila.dia, Number(fila.unidades)]));

  // 3. Arma la serie diaria completa: todos los días del rango, con 0 si no hubo ventas.
  const serie = [];
  const inicio = Date.parse(`${desde}T00:00:00Z`);
  const fin = Date.parse(`${hasta}T00:00:00Z`);
  for (let t = inicio; t <= fin; t += MS_POR_DIA) {
    const dia = new Date(t).toISOString().slice(0, 10);
    serie.push({ dia, unidades: porDia.get(dia) || 0 });
  }

  // 4. Conteo exacto: la suma de todas las unidades vendidas.
  const unidadesVendidas = serie.reduce((suma, punto) => suma + punto.unidades, 0);

  // 5. Regla del trapecio: cada tira vale el promedio de dos días seguidos
  // multiplicado por el ancho (1 día). Se necesitan al menos 2 días.
  let demandaTrapecio = null;
  if (serie.length >= 2) {
    demandaTrapecio = 0;
    for (let i = 0; i < serie.length - 1; i++) {
      demandaTrapecio += (serie[i].unidades + serie[i + 1].unidades) / 2;
    }
  }

  const resultado = {
    producto: { id_producto: productos[0].id_producto, nombre: productos[0].nombre },
    desde,
    hasta,
    dias: serie.length,
    unidades_vendidas: unidadesVendidas,
    demanda_trapecio: demandaTrapecio,
    serie
  };

  // Con un solo día no hay tiras que sumar: lo explicamos.
  if (demandaTrapecio === null) {
    resultado.nota = 'La regla del trapecio necesita un rango de al menos 2 días.';
  }

  return resultado;
}

module.exports = { calcularDemanda };