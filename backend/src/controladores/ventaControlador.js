// ============================================================
// ventaControlador.js
// Lógica de las ventas.
// ============================================================

// La conexión a MySQL.
const pool = require('../config/baseDatos');

// Funciones comunes (convertir números, estado de stock).
const { aNumero, vino, calcularEstado, esFechaValida } = require('../utilidades/comunes');

// Límites de una venta.
const MAXIMO_RENGLONES = 50;
const MAXIMO_UNIDADES = 1000000;
// Tope del total, en centavos (la columna guarda hasta 9.999.999.999,99).
const MAXIMO_TOTAL_CENTAVOS = 999999999900;

// Registra una venta completa.
// Uso: POST /api/ventas
// Cuerpo: { "items": [ { "id_producto": 1, "cantidad": 2 } ], "efectivo_recibido": 20000 }
// El precio NUNCA lo manda la app: el backend lo lee de la base de datos.
async function registrarVenta(req, res) {
  const cuerpo = req.body || {};

  // 1. Revisa que haya una lista de productos.
  if (!Array.isArray(cuerpo.items) || cuerpo.items.length === 0) {
    return res.status(400).json({ mensaje: 'La venta debe tener al menos un producto.' });
  }
  if (cuerpo.items.length > MAXIMO_RENGLONES) {
    return res.status(400).json({ mensaje: `Una venta no puede tener más de ${MAXIMO_RENGLONES} renglones.` });
  }

  // 2. Revisa cada renglón y junta los repetidos del mismo producto.
  // pedidas: lista de pares "número de producto -> unidades pedidas".
  const pedidas = new Map();
  for (const item of cuerpo.items) {
    const idProducto = aNumero(item && item.id_producto);
    const cantidad = aNumero(item && item.cantidad);

    if (idProducto === null || !Number.isInteger(idProducto) || idProducto < 1) {
      return res.status(400).json({ mensaje: 'Hay un producto con número no válido.' });
    }
    if (cantidad === null || !Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAXIMO_UNIDADES) {
      return res.status(400).json({
        mensaje: 'Las unidades de cada producto deben ser un número entero entre 1 y 1.000.000.'
      });
    }

    const acumulado = (pedidas.get(idProducto) || 0) + cantidad;
    if (acumulado > MAXIMO_UNIDADES) {
      return res.status(400).json({
        mensaje: 'Las unidades de un mismo producto no pueden superar 1.000.000.'
      });
    }
    pedidas.set(idProducto, acumulado);
  }

  // 3. Efectivo recibido: opcional. Se convierte a centavos enteros.
  let efectivoCentavos = null;
  if (vino(cuerpo.efectivo_recibido)) {
    const efectivo = aNumero(cuerpo.efectivo_recibido);
    if (efectivo === null || efectivo < 0 || efectivo > 10000000000) {
      return res.status(400).json({ mensaje: 'El efectivo recibido no es válido.' });
    }
    efectivoCentavos = Math.round(efectivo * 100);
  }

  // Los números de producto, ordenados de menor a mayor.
  // Siempre se reservan en este orden para que dos ventas al mismo tiempo no se traben.
  const ids = [...pedidas.keys()].sort((a, b) => a - b);

  let conexion;
  try {
    // Toma una conexión para la transacción ("todo o nada").
    conexion = await pool.getConnection();
    await conexion.beginTransaction();

    // 4. Busca los productos activos y los "reserva" (FOR UPDATE) hasta terminar la venta.
    const [productos] = await conexion.query(
      `SELECT id_producto, nombre, cantidad, stock_minimo, precio_compra, precio_venta, iva
       FROM producto
       WHERE id_producto IN (?) AND activo = 1
       ORDER BY id_producto
       FOR UPDATE`,
      [ids]
    );

    // Si falta alguno (no existe o fue eliminado), no se vende nada.
    if (productos.length !== ids.length) {
      const encontrados = new Set(productos.map((p) => p.id_producto));
      const faltante = ids.find((id) => !encontrados.has(id));
      await conexion.rollback();
      return res.status(404).json({ mensaje: `El producto número ${faltante} no existe.` });
    }

    // 5. REGLA DE STOCK: no se puede vender más de lo disponible.
    // Se revisa con el stock ya reservado, así dos ventas simultáneas no se pisan.
    const faltantes = [];
    for (const producto of productos) {
      const solicitadas = pedidas.get(producto.id_producto);
      if (solicitadas > producto.cantidad) {
        faltantes.push({
          id_producto: producto.id_producto,
          nombre: producto.nombre,
          solicitadas,
          disponibles: producto.cantidad
        });
      }
    }
    if (faltantes.length > 0) {
      await conexion.rollback();
      return res.status(409).json({
        mensaje: 'No hay suficiente stock para completar la venta.',
        faltantes
      });
    }

    // 6. Calcula los valores de cada renglón en centavos enteros.
    // El precio de venta YA incluye el IVA: el cliente paga precio x cantidad,
    // y aquí separamos cuánto de ese total es IVA.
    const renglones = productos.map((producto) => {
      const unidades = pedidas.get(producto.id_producto);
      const precioCentavos = Math.round(Number(producto.precio_venta) * 100);
      const totalCentavos = precioCentavos * unidades;
      const baseCentavos = Math.round(totalCentavos / (1 + Number(producto.iva) / 100));
      return {
        producto,
        unidades,
        precioCentavos,
        totalCentavos,
        baseCentavos,
        ivaCentavos: totalCentavos - baseCentavos
      };
    });

    const totalCentavos = renglones.reduce((suma, r) => suma + r.totalCentavos, 0);
    const baseCentavos = renglones.reduce((suma, r) => suma + r.baseCentavos, 0);
    const ivaCentavos = renglones.reduce((suma, r) => suma + r.ivaCentavos, 0);

    if (totalCentavos > MAXIMO_TOTAL_CENTAVOS) {
      await conexion.rollback();
      return res.status(400).json({ mensaje: 'El total de la venta es demasiado grande.' });
    }

    // Si dieron efectivo, tiene que alcanzar para pagar.
    if (efectivoCentavos !== null && efectivoCentavos < totalCentavos) {
      await conexion.rollback();
      return res.status(400).json({
        mensaje: 'El efectivo recibido no alcanza para pagar el total.',
        total: totalCentavos / 100
      });
    }

    // 7. Guarda la cabecera de la venta (el tiquete). La fecha la pone MySQL sola.
    const [cabecera] = await conexion.query(
      'INSERT INTO cabecera_venta (valor_pagar, id_usuario) VALUES (?, ?)',
      [totalCentavos / 100, req.usuario.id_usuario]
    );
    const idVenta = cabecera.insertId;

    // 8. Por cada renglón: guarda el detalle, descuenta el stock y anota el movimiento.
    for (const r of renglones) {
      const producto = r.producto;
      const stockNuevo = producto.cantidad - r.unidades;

      // Detalle de la venta (descuento 0: el mockup no maneja descuentos).
      await conexion.query(
        `INSERT INTO detalle_venta
           (cantidad, precio_und, costo_und, subtotal, descuento, total_pagar, id_venta, id_producto)
         VALUES (?, ?, ?, ?, 0, ?, ?, ?)`,
        [r.unidades, r.precioCentavos / 100, producto.precio_compra, r.totalCentavos / 100,
         r.totalCentavos / 100, idVenta, producto.id_producto]
      );

      // Descuenta el stock. "AND cantidad >= ?" es un seguro extra: si por alguna
      // razón ya no alcanzara, no resta nada y la venta completa se deshace.
      const [actualizado] = await conexion.query(
        'UPDATE producto SET cantidad = cantidad - ? WHERE id_producto = ? AND cantidad >= ?',
        [r.unidades, producto.id_producto, r.unidades]
      );
      if (actualizado.affectedRows !== 1) {
        throw new Error(`No se pudo descontar el stock del producto ${producto.id_producto}.`);
      }

      // Anota la salida en el cuaderno de entradas y salidas.
      await conexion.query(
        `INSERT INTO movimiento_inventario
           (tipo_movimiento, cantidad, stock_anterior, stock_nuevo, id_usuario, id_producto)
         VALUES ('venta', ?, ?, ?, ?, ?)`,
        [r.unidades, producto.cantidad, stockNuevo, req.usuario.id_usuario, producto.id_producto]
      );
    }

    // 9. Lee la fecha que MySQL le puso a la venta.
    const [fechas] = await conexion.query(
      'SELECT fecha_venta FROM cabecera_venta WHERE id_venta = ?',
      [idVenta]
    );

    // Confirma: ahora sí quedan guardados todos los registros de la venta.
    await conexion.commit();

    // 10. Arma la respuesta con los datos del ticket.
    const venta = {
      id_venta: idVenta,
      fecha_venta: fechas[0].fecha_venta,
      vendedor: `${req.usuario.nombre} ${req.usuario.apellidos}`,
      items: renglones.map((r) => ({
        id_producto: r.producto.id_producto,
        nombre: r.producto.nombre,
        cantidad: r.unidades,
        precio_und: r.precioCentavos / 100,
        total: r.totalCentavos / 100
      })),
      subtotal: baseCentavos / 100,
      iva_total: ivaCentavos / 100,
      total: totalCentavos / 100
    };

    // Si dieron efectivo, devolvemos también el cambio.
    if (efectivoCentavos !== null) {
      venta.efectivo_recibido = efectivoCentavos / 100;
      venta.cambio = (efectivoCentavos - totalCentavos) / 100;
    }

    const respuesta = { mensaje: 'Venta registrada.', venta };

    // La alerta de stock bajo es solo para el administrador.
    if (req.usuario.rol === 'administrador') {
      respuesta.alertas_stock_bajo = renglones
        .map((r) => {
          const cantidad = r.producto.cantidad - r.unidades;
          return {
            id_producto: r.producto.id_producto,
            nombre: r.producto.nombre,
            cantidad,
            stock_minimo: r.producto.stock_minimo,
            estado: calcularEstado(cantidad, r.producto.stock_minimo)
          };
        })
        .filter((alerta) => alerta.estado !== 'disponible');
    }

    return res.status(201).json(respuesta);
  } catch (error) {
    // Si algo falló, deshace todo lo que se había hecho.
    if (conexion) await conexion.rollback();

    console.error('Error al registrar la venta:', error.message);
    return res.status(500).json({ mensaje: 'Ocurrió un error en el servidor.' });
  } finally {
    // Devuelve la conexión al pool, pase lo que pase.
    if (conexion) conexion.release();
  }
}

// ------------------------------------------------------------
// Consultar ventas
// ------------------------------------------------------------

// Máximo de ventas que se listan de una sola vez.
const MAXIMO_VENTAS_LISTA = 500;

// Devuelve las ventas de un rango de fechas, con sus totales.
// Uso: GET /api/ventas                                   (ventas de hoy)
//      GET /api/ventas?desde=2026-10-01&hasta=2026-10-12
async function listarVentas(req, res) {
  try {
    let { desde, hasta } = req.query;

    // O se envían las dos fechas, o ninguna.
    if ((desde === undefined) !== (hasta === undefined)) {
      return res.status(400).json({ mensaje: 'Envía las dos fechas, "desde" y "hasta", o ninguna.' });
    }

    if (desde === undefined) {
      // Sin fechas: usamos el día de hoy según la base de datos.
      const [hoyFilas] = await pool.query("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS hoy");
      desde = hoyFilas[0].hoy;
      hasta = hoyFilas[0].hoy;
    } else {
      // Con fechas: revisamos el formato, el orden y el tamaño del rango.
      if (!esFechaValida(desde) || !esFechaValida(hasta)) {
        return res.status(400).json({
          mensaje: 'Las fechas deben ser reales y tener el formato AAAA-MM-DD, por ejemplo 2026-10-12.'
        });
      }
      if (desde > hasta) {
        return res.status(400).json({ mensaje: 'La fecha "desde" no puede ser posterior a "hasta".' });
      }
      const dias = (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000 + 1;
      if (dias > 366) {
        return res.status(400).json({ mensaje: 'El rango no puede superar 366 días.' });
      }
    }

    // Totales de TODAS las ventas del rango (aunque la lista se corte en 500).
    const [totales] = await pool.query(
      `SELECT COUNT(*) AS total_ventas, COALESCE(SUM(valor_pagar), 0) AS total_ingresos
       FROM cabecera_venta
       WHERE fecha_venta >= ? AND fecha_venta < DATE_ADD(CAST(? AS DATE), INTERVAL 1 DAY)`,
      [desde, hasta]
    );

    // Lista de ventas, de la más reciente a la más antigua.
    const [ventas] = await pool.query(
      `SELECT v.id_venta, v.fecha_venta, v.valor_pagar AS total,
              CONCAT(u.nombre, ' ', u.apellidos) AS vendedor,
              COUNT(d.id_detalle) AS renglones,
              SUM(d.cantidad) AS unidades
       FROM cabecera_venta v
       JOIN usuario u ON u.id_usuario = v.id_usuario
       JOIN detalle_venta d ON d.id_venta = v.id_venta
       WHERE v.fecha_venta >= ? AND v.fecha_venta < DATE_ADD(CAST(? AS DATE), INTERVAL 1 DAY)
       GROUP BY v.id_venta, v.fecha_venta, v.valor_pagar, u.nombre, u.apellidos
       ORDER BY v.fecha_venta DESC, v.id_venta DESC
       LIMIT ?`,
      [desde, hasta, MAXIMO_VENTAS_LISTA]
    );

    const totalVentas = Number(totales[0].total_ventas);

    return res.json({
      desde,
      hasta,
      total_ventas: totalVentas,
      total_ingresos: Number(totales[0].total_ingresos),
      mostrando: ventas.length,
      hay_mas: totalVentas > ventas.length,
      ventas: ventas.map((v) => ({
        id_venta: v.id_venta,
        fecha_venta: v.fecha_venta,
        vendedor: v.vendedor,
        renglones: Number(v.renglones),
        unidades: Number(v.unidades),
        total: Number(v.total)
      }))
    });
  } catch (error) {
    // Si algo inesperado falla, lo anotamos en la terminal y avisamos con un mensaje simple.
    console.error('Error al consultar ventas:', error.message);
    return res.status(500).json({ mensaje: 'Ocurrió un error en el servidor.' });
  }
}

module.exports = { registrarVenta, listarVentas };