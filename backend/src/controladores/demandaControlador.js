// ============================================================
// demandaControlador.js
// Consulta de la demanda de un producto en un rango de fechas.
// ============================================================

// Funciones comunes (revisar fechas).
const { leerRangoFechas } = require('../utilidades/comunes');

// El cálculo de la demanda.
const { calcularDemanda } = require('../utilidades/demanda');

// Devuelve las unidades vendidas y la demanda por trapecio de un producto.
// Uso: GET /api/demanda?producto=3&desde=2026-10-01&hasta=2026-10-12
async function demandaProducto(req, res) {
  try {
    // El producto es obligatorio: un número entero positivo.
    const producto = req.query.producto;
    if (typeof producto !== 'string' || !/^\d+$/.test(producto) || Number(producto) < 1) {
      return res.status(400).json({ mensaje: 'Elige un producto válido.' });
    }

    // Las dos fechas son obligatorias.
    if (req.query.desde === undefined || req.query.hasta === undefined) {
      return res.status(400).json({ mensaje: 'Envía las dos fechas, "desde" y "hasta".' });
    }

    // Revisa que sean fechas reales, en orden y de máximo 366 días.
    const rango = leerRangoFechas(req.query);
    if (rango.error) {
      return res.status(400).json({ mensaje: rango.error });
    }

    const resultado = await calcularDemanda(Number(producto), rango.desde, rango.hasta);
    if (resultado === null) {
      return res.status(404).json({ mensaje: 'El producto no existe.' });
    }

    return res.json(resultado);
  } catch (error) {
    // Si algo inesperado falla, lo anotamos en la terminal y avisamos con un mensaje simple.
    console.error('Error al calcular la demanda:', error.message);
    return res.status(500).json({ mensaje: 'Ocurrió un error en el servidor.' });
  }
}

module.exports = { demandaProducto };