// ============================================================
// historialControlador.js
// Consulta del historial: movimientos de inventario y auditoría.
// Todo es de solo lectura y solo para el administrador.
// ============================================================

// La conexión a MySQL.
const pool = require('../config/baseDatos');

// Funciones comunes (convertir números, fechas).
const { leerRangoFechas, fechaDeHoy } = require('../utilidades/comunes');

// Máximo de filas que se listan de una sola vez.
const MAXIMO_FILAS = 500;

// ------------------------------------------------------------
// Movimientos de inventario
// ------------------------------------------------------------

// Devuelve las entradas y salidas de mercancía de un rango de fechas.
// Uso: GET /api/historial/movimientos
//      GET /api/historial/movimientos?desde=2026-10-01&hasta=2026-10-12&tipo=venta&producto=3
async function listarMovimientos(req, res) {
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

    // Reglas de la consulta. Cada filtro que llegue agrega una regla más.
    const condiciones = [
      'm.fecha >= ?',
      'm.fecha < DATE_ADD(CAST(? AS DATE), INTERVAL 1 DAY)'
    ];
    const valores = [desde, hasta];

    // Filtro por tipo: solo aceptamos tres palabras (lista blanca).
    if (req.query.tipo !== undefined) {
      const tipo = req.query.tipo;
      if (tipo !== 'ingreso' && tipo !== 'venta' && tipo !== 'ajuste') {
        return res.status(400).json({ mensaje: 'El tipo debe ser "ingreso", "venta" o "ajuste".' });
      }
      condiciones.push('m.tipo_movimiento = ?');
      valores.push(tipo);
    }

    // Filtro por producto: debe ser un número entero positivo.
    if (req.query.producto !== undefined) {
      const producto = req.query.producto;
      if (typeof producto !== 'string' || !/^\d+$/.test(producto) || Number(producto) < 1) {
        return res.status(400).json({ mensaje: 'El producto no es válido.' });
      }
      condiciones.push('m.id_producto = ?');
      valores.push(Number(producto));
    }

    const donde = condiciones.join(' AND ');

    // Resumen de TODOS los movimientos que cumplen el filtro (aunque la lista se corte).
    const [resumen] = await pool.query(
      `SELECT COUNT(*) AS total_movimientos,
              COALESCE(SUM(CASE WHEN m.tipo_movimiento = 'ingreso' THEN m.cantidad ELSE 0 END), 0) AS unidades_ingreso,
              COALESCE(SUM(CASE WHEN m.tipo_movimiento = 'venta' THEN m.cantidad ELSE 0 END), 0) AS unidades_venta
       FROM movimiento_inventario m
       WHERE ${donde}`,
      valores
    );

    // Lista de movimientos, del más reciente al más antiguo.
    const [movimientos] = await pool.query(
      `SELECT m.id_movimiento, m.fecha, m.tipo_movimiento AS tipo, m.cantidad,
              m.stock_anterior, m.stock_nuevo,
              m.id_producto, p.nombre AS producto,
              CONCAT(u.nombre, ' ', u.apellidos) AS usuario
       FROM movimiento_inventario m
       JOIN producto p ON p.id_producto = m.id_producto
       JOIN usuario u ON u.id_usuario = m.id_usuario
       WHERE ${donde}
       ORDER BY m.fecha DESC, m.id_movimiento DESC
       LIMIT ?`,
      [...valores, MAXIMO_FILAS]
    );

    const total = Number(resumen[0].total_movimientos);

    return res.json({
      desde,
      hasta,
      total_movimientos: total,
      unidades_ingreso: Number(resumen[0].unidades_ingreso),
      unidades_venta: Number(resumen[0].unidades_venta),
      mostrando: movimientos.length,
      hay_mas: total > movimientos.length,
      movimientos
    });
  } catch (error) {
    // Si algo inesperado falla, lo anotamos en la terminal y avisamos con un mensaje simple.
    console.error('Error al consultar movimientos:', error.message);
    return res.status(500).json({ mensaje: 'Ocurrió un error en el servidor.' });
  }
}

// ------------------------------------------------------------
// Auditoría
// ------------------------------------------------------------

// Devuelve quién hizo qué cambio, con el "antes" y el "después".
// Uso: GET /api/historial/auditoria
//      GET /api/historial/auditoria?desde=2026-10-01&hasta=2026-10-12&entidad=producto&accion=eliminar
async function listarAuditoria(req, res) {
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

    // Reglas de la consulta. Cada filtro que llegue agrega una regla más.
    const condiciones = [
      'a.fecha >= ?',
      'a.fecha < DATE_ADD(CAST(? AS DATE), INTERVAL 1 DAY)'
    ];
    const valores = [desde, hasta];

    // Filtro por entidad: solo aceptamos tres palabras (lista blanca).
    if (req.query.entidad !== undefined) {
      const entidad = req.query.entidad;
      if (entidad !== 'producto' && entidad !== 'categoria' && entidad !== 'usuario') {
        return res.status(400).json({ mensaje: 'La entidad debe ser "producto", "categoria" o "usuario".' });
      }
      condiciones.push('a.entidad = ?');
      valores.push(entidad);
    }

    // Filtro por acción: solo aceptamos tres palabras (lista blanca).
    if (req.query.accion !== undefined) {
      const accion = req.query.accion;
      if (accion !== 'crear' && accion !== 'modificar' && accion !== 'eliminar') {
        return res.status(400).json({ mensaje: 'La acción debe ser "crear", "modificar" o "eliminar".' });
      }
      condiciones.push('a.accion = ?');
      valores.push(accion);
    }

    const donde = condiciones.join(' AND ');

    // Cuántos registros cumplen el filtro (aunque la lista se corte).
    const [resumen] = await pool.query(
      `SELECT COUNT(*) AS total FROM auditoria a WHERE ${donde}`,
      valores
    );

    // Lista de cambios, del más reciente al más antiguo.
    // valor_anterior y valor_nuevo llegan ya como objetos, no como texto.
    const [registros] = await pool.query(
      `SELECT a.id_auditoria, a.fecha, a.accion, a.entidad, a.id_registro,
              a.id_usuario, CONCAT(u.nombre, ' ', u.apellidos) AS usuario,
              a.valor_anterior, a.valor_nuevo
       FROM auditoria a
       JOIN usuario u ON u.id_usuario = a.id_usuario
       WHERE ${donde}
       ORDER BY a.fecha DESC, a.id_auditoria DESC
       LIMIT ?`,
      [...valores, MAXIMO_FILAS]
    );

    const total = Number(resumen[0].total);

    return res.json({
      desde,
      hasta,
      total_registros: total,
      mostrando: registros.length,
      hay_mas: total > registros.length,
      registros
    });
  } catch (error) {
    // Si algo inesperado falla, lo anotamos en la terminal y avisamos con un mensaje simple.
    console.error('Error al consultar la auditoría:', error.message);
    return res.status(500).json({ mensaje: 'Ocurrió un error en el servidor.' });
  }
}

module.exports = { listarMovimientos, listarAuditoria };