// ============================================================
// reporteControlador.js
// Reportes del administrador: resumen del panel, alertas de stock
// bajo y rentabilidad. Todo es de solo lectura.
// ============================================================

// La conexión a MySQL.
const pool = require('../config/baseDatos');

// Funciones comunes (revisar fechas).
const { leerRangoFechas, fechaDeHoy } = require('../utilidades/comunes');

// ------------------------------------------------------------
// Funciones auxiliares
// ------------------------------------------------------------

// Pasa pesos a centavos enteros, para sumar sin errores de decimales.
function aCentavos(valor) {
  return Math.round(Number(valor) * 100);
}

// Margen: la ganancia como porcentaje de lo vendido sin IVA, con 2 decimales.
// Si no hubo ventas, devuelve null.
function calcularMargen(gananciaCentavos, baseCentavos) {
  if (baseCentavos <= 0) return null;
  return Math.round((gananciaCentavos / baseCentavos) * 10000) / 100;
}

// ------------------------------------------------------------
// Resumen del panel
// ------------------------------------------------------------

// Devuelve los dos datos del panel del administrador: "Stock Bajo" y "Ventas Hoy".
// Uso: GET /api/reportes/resumen
async function resumenPanel(req, res) {
  try {
    // Cuenta los productos activos que están agotados o en su stock mínimo.
    const [stock] = await pool.query(
      `SELECT COALESCE(SUM(cantidad = 0), 0) AS agotados,
              COALESCE(SUM(cantidad > 0 AND cantidad <= stock_minimo), 0) AS bajos
       FROM producto
       WHERE activo = 1`
    );

    // Cuenta y suma las ventas de hoy.
    const hoy = await fechaDeHoy(pool);
    const [ventas] = await pool.query(
      `SELECT COUNT(*) AS total_ventas, COALESCE(SUM(valor_pagar), 0) AS total_ingresos
       FROM cabecera_venta
       WHERE fecha_venta >= ? AND fecha_venta < DATE_ADD(CAST(? AS DATE), INTERVAL 1 DAY)`,
      [hoy, hoy]
    );

    const agotados = Number(stock[0].agotados);
    const bajos = Number(stock[0].bajos);

    return res.json({
      stock_bajo: { total: agotados + bajos, bajos, agotados },
      ventas_hoy: {
        fecha: hoy,
        total_ventas: Number(ventas[0].total_ventas),
        total_ingresos: Number(ventas[0].total_ingresos)
      }
    });
  } catch (error) {
    // Si algo inesperado falla, lo anotamos en la terminal y avisamos con un mensaje simple.
    console.error('Error al armar el resumen:', error.message);
    return res.status(500).json({ mensaje: 'Ocurrió un error en el servidor.' });
  }
}

// ------------------------------------------------------------
// Alertas de stock bajo
// ------------------------------------------------------------

// Devuelve los productos activos que están agotados o en su stock mínimo.
// Los más urgentes salen primero. Uso: GET /api/reportes/stock-bajo
async function stockBajo(req, res) {
  try {
    const [productos] = await pool.query(
      `SELECT p.id_producto, p.nombre, c.nombre AS categoria,
              p.cantidad, p.stock_minimo, p.precio_compra,
              CASE WHEN p.cantidad = 0 THEN 'agotado' ELSE 'bajo' END AS estado
       FROM producto p
       JOIN categoria c ON c.id_categoria = p.id_categoria
       WHERE p.activo = 1 AND p.cantidad <= p.stock_minimo
       ORDER BY p.cantidad, p.nombre`
    );

    const agotados = productos.filter((p) => p.estado === 'agotado').length;

    return res.json({
      total: productos.length,
      agotados,
      bajos: productos.length - agotados,
      productos
    });
  } catch (error) {
    console.error('Error al consultar el stock bajo:', error.message);
    return res.status(500).json({ mensaje: 'Ocurrió un error en el servidor.' });
  }
}

// ------------------------------------------------------------
// Rentabilidad
// ------------------------------------------------------------

// Devuelve lo vendido, lo que costó y lo ganado, por producto y en total.
// Uso: GET /api/reportes/rentabilidad                                  (hoy)
//      GET /api/reportes/rentabilidad?desde=2026-10-01&hasta=2026-10-12
async function rentabilidad(req, res) {
  try {
    // Revisa el rango de fechas. Sin fechas, se usa el día de hoy.
    const rango = leerRangoFechas(req.query);
    if (rango.error) {
      return res.status(400).json({ mensaje: rango.error });
    }
    let { desde, hasta } = rango;
    if (rango.sinFechas) {
      desde = hasta = await fechaDeHoy(pool);
    }

    // Por cada producto vendido: unidades, ingresos (con IVA), ingresos sin IVA y costo.
    // El precio de venta YA incluye el IVA, así que lo separamos renglón por renglón.
    const [filas] = await pool.query(
      `SELECT p.id_producto, p.nombre,
              SUM(d.cantidad) AS unidades,
              SUM(d.total_pagar) AS ingresos,
              SUM(ROUND(d.total_pagar / (1 + p.iva / 100), 2)) AS ingresos_sin_iva,
              SUM(d.costo_und * d.cantidad) AS costo
       FROM detalle_venta d
       JOIN cabecera_venta v ON v.id_venta = d.id_venta
       JOIN producto p ON p.id_producto = d.id_producto
       WHERE v.fecha_venta >= ?
         AND v.fecha_venta < DATE_ADD(CAST(? AS DATE), INTERVAL 1 DAY)
       GROUP BY p.id_producto, p.nombre`,
      [desde, hasta]
    );

    // Calcula todo en centavos enteros para que las sumas den exactas.
    const productos = filas.map((fila) => {
      const ingresos = aCentavos(fila.ingresos);
      const base = aCentavos(fila.ingresos_sin_iva);
      const costo = aCentavos(fila.costo);
      return {
        id_producto: fila.id_producto,
        nombre: fila.nombre,
        unidades: Number(fila.unidades),
        ingresosC: ingresos,
        ivaC: ingresos - base,
        baseC: base,
        costoC: costo,
        gananciaC: base - costo
      };
    });

    // Los más rentables primero.
    productos.sort((a, b) => b.gananciaC - a.gananciaC || a.nombre.localeCompare(b.nombre));

    // Totales de todos los productos.
    const total = productos.reduce(
      (suma, p) => ({
        unidades: suma.unidades + p.unidades,
        ingresosC: suma.ingresosC + p.ingresosC,
        ivaC: suma.ivaC + p.ivaC,
        baseC: suma.baseC + p.baseC,
        costoC: suma.costoC + p.costoC,
        gananciaC: suma.gananciaC + p.gananciaC
      }),
      { unidades: 0, ingresosC: 0, ivaC: 0, baseC: 0, costoC: 0, gananciaC: 0 }
    );

    // Convierte los centavos a pesos y agrega el margen.
    const presentar = (p) => ({
      unidades: p.unidades,
      ingresos: p.ingresosC / 100,
      iva: p.ivaC / 100,
      ingresos_sin_iva: p.baseC / 100,
      costo: p.costoC / 100,
      ganancia: p.gananciaC / 100,
      margen_porcentaje: calcularMargen(p.gananciaC, p.baseC)
    });

    return res.json({
      desde,
      hasta,
      resumen: presentar(total),
      productos: productos.map((p) => ({
        id_producto: p.id_producto,
        nombre: p.nombre,
        ...presentar(p)
      }))
    });
  } catch (error) {
    console.error('Error al calcular la rentabilidad:', error.message);
    return res.status(500).json({ mensaje: 'Ocurrió un error en el servidor.' });
  }
}

module.exports = { resumenPanel, stockBajo, rentabilidad };