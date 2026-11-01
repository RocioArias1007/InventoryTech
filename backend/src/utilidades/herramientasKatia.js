// ============================================================
// herramientasKatia.js
// Las consultas fijas que Katia puede pedir, separadas por rol.
// Gemini nunca escribe SQL: solo elige una de estas herramientas.
// ============================================================

const pool = require('../config/baseDatos');
const { leerRangoFechas } = require('./comunes');
const { calcularDemanda } = require('./demanda');

// ------------------------------------------------------------
// Funciones auxiliares
// ------------------------------------------------------------

// Limpia el texto de búsqueda y lo prepara para LIKE (sin comodines del usuario).
function patronDeBusqueda(valor) {
  if (typeof valor !== 'string') return null;
  const texto = valor.trim().slice(0, 60);
  if (texto === '') return null;
  return `%${texto.replace(/[\\%_]/g, '\\$&')}%`;
}

// Revisa las fechas que pide Gemini con las mismas reglas del resto del sistema.
function leerFechas(args) {
  const rango = leerRangoFechas({ desde: args.desde, hasta: args.hasta });
  if (rango.error) return { error: rango.error };
  if (rango.sinFechas) return { error: 'Indica las fechas "desde" y "hasta" con formato AAAA-MM-DD.' };
  return rango;
}

// Busca UN producto activo por nombre. Si hay dudas, devuelve la lista de opciones.
async function buscarUnProducto(nombre) {
  const patron = patronDeBusqueda(nombre);
  if (!patron) return { error: 'Falta el nombre del producto.' };

  const [filas] = await pool.query(
    `SELECT id_producto, nombre, precio_compra
     FROM producto
     WHERE activo = 1 AND nombre LIKE ?
     ORDER BY nombre
     LIMIT 6`,
    [patron]
  );

  if (filas.length === 0) return { error: 'No encontré ningún producto con ese nombre.' };
  if (filas.length > 1) {
    return {
      error: 'Hay varios productos que coinciden. Pide al usuario que diga cuál.',
      opciones: filas.map((f) => f.nombre)
    };
  }
  return { producto: filas[0] };
}

const ESTADO_SQL = `CASE WHEN p.cantidad = 0 THEN 'agotado'
                         WHEN p.cantidad <= p.stock_minimo THEN 'stock bajo'
                         ELSE 'disponible' END`;

// ------------------------------------------------------------
// Las herramientas
// ------------------------------------------------------------

const HERRAMIENTAS = [
  // ----- Para administrador y empleado -----
  {
    roles: ['administrador', 'empleado'],
    definicion: {
      type: 'function',
      name: 'consultar_existencias',
      description:
        'Dice cuántas unidades quedan de un producto, su estado y su precio de venta (el precio ya incluye IVA).',
      parameters: {
        type: 'object',
        properties: {
          producto: { type: 'string', description: 'Nombre o parte del nombre del producto, por ejemplo "arroz".' }
        },
        required: ['producto']
      }
    },
    async ejecutar(args) {
      const patron = patronDeBusqueda(args.producto);
      if (!patron) return { error: 'Falta el nombre del producto.' };

      const [filas] = await pool.query(
        `SELECT p.nombre, c.nombre AS categoria, p.cantidad, p.stock_minimo, p.precio_venta,
                ${ESTADO_SQL} AS estado
         FROM producto p
         JOIN categoria c ON c.id_categoria = p.id_categoria
         WHERE p.activo = 1 AND p.nombre LIKE ?
         ORDER BY p.nombre
         LIMIT 5`,
        [patron]
      );
      if (filas.length === 0) return { coincidencias: [], nota: 'No encontré productos con ese nombre.' };
      return { coincidencias: filas };
    }
  },
  {
    roles: ['administrador', 'empleado'],
    definicion: {
      type: 'function',
      name: 'listar_stock_bajo',
      description: 'Lista los productos agotados o con poco stock (en su mínimo o por debajo).',
      parameters: { type: 'object', properties: {} }
    },
    async ejecutar() {
      const [filas] = await pool.query(
        `SELECT p.nombre, p.cantidad, p.stock_minimo, ${ESTADO_SQL} AS estado
         FROM producto p
         WHERE p.activo = 1 AND p.cantidad <= p.stock_minimo
         ORDER BY p.cantidad, p.nombre
         LIMIT 30`
      );
      return { total: filas.length, productos: filas };
    }
  },

  // ----- Solo administrador -----
  {
    roles: ['administrador'],
    definicion: {
      type: 'function',
      name: 'ventas_del_periodo',
      description: 'Da el número de ventas y el total vendido en pesos entre dos fechas (incluidas).',
      parameters: {
        type: 'object',
        properties: {
          desde: { type: 'string', description: 'Fecha inicial, formato AAAA-MM-DD.' },
          hasta: { type: 'string', description: 'Fecha final, formato AAAA-MM-DD.' }
        },
        required: ['desde', 'hasta']
      }
    },
    async ejecutar(args) {
      const rango = leerFechas(args);
      if (rango.error) return { error: rango.error };

      const [filas] = await pool.query(
        `SELECT COUNT(*) AS total_ventas, COALESCE(SUM(valor_pagar), 0) AS total_vendido
         FROM cabecera_venta
         WHERE fecha_venta >= ? AND fecha_venta < DATE_ADD(CAST(? AS DATE), INTERVAL 1 DAY)`,
        [rango.desde, rango.hasta]
      );
      return {
        desde: rango.desde,
        hasta: rango.hasta,
        total_ventas: Number(filas[0].total_ventas),
        total_vendido_pesos: Number(filas[0].total_vendido)
      };
    }
  },
  {
    roles: ['administrador'],
    definicion: {
      type: 'function',
      name: 'productos_mas_vendidos',
      description: 'Da los 5 productos más vendidos (por unidades) entre dos fechas.',
      parameters: {
        type: 'object',
        properties: {
          desde: { type: 'string', description: 'Fecha inicial, formato AAAA-MM-DD.' },
          hasta: { type: 'string', description: 'Fecha final, formato AAAA-MM-DD.' }
        },
        required: ['desde', 'hasta']
      }
    },
    async ejecutar(args) {
      const rango = leerFechas(args);
      if (rango.error) return { error: rango.error };

      const [filas] = await pool.query(
        `SELECT p.nombre, SUM(d.cantidad) AS unidades, SUM(d.total_pagar) AS vendido_pesos
         FROM detalle_venta d
         JOIN cabecera_venta v ON v.id_venta = d.id_venta
         JOIN producto p ON p.id_producto = d.id_producto
         WHERE v.fecha_venta >= ? AND v.fecha_venta < DATE_ADD(CAST(? AS DATE), INTERVAL 1 DAY)
         GROUP BY p.id_producto, p.nombre
         ORDER BY unidades DESC, p.nombre
         LIMIT 5`,
        [rango.desde, rango.hasta]
      );
      return {
        desde: rango.desde,
        hasta: rango.hasta,
        productos: filas.map((f) => ({
          nombre: f.nombre,
          unidades: Number(f.unidades),
          vendido_pesos: Number(f.vendido_pesos)
        }))
      };
    }
  },
  {
    roles: ['administrador'],
    definicion: {
      type: 'function',
      name: 'demanda_producto',
      description:
        'Calcula las unidades vendidas y la demanda por la regla del trapecio de UN producto entre dos fechas.',
      parameters: {
        type: 'object',
        properties: {
          producto: { type: 'string', description: 'Nombre del producto.' },
          desde: { type: 'string', description: 'Fecha inicial, formato AAAA-MM-DD.' },
          hasta: { type: 'string', description: 'Fecha final, formato AAAA-MM-DD.' }
        },
        required: ['producto', 'desde', 'hasta']
      }
    },
    async ejecutar(args) {
      const rango = leerFechas(args);
      if (rango.error) return { error: rango.error };

      const buscado = await buscarUnProducto(args.producto);
      if (buscado.error) return buscado;

      const r = await calcularDemanda(buscado.producto.id_producto, rango.desde, rango.hasta);
      if (r === null) return { error: 'El producto no existe.' };

      // No enviamos la serie diaria completa: es larga y no hace falta para responder.
      return {
        producto: r.producto.nombre,
        desde: r.desde,
        hasta: r.hasta,
        dias: r.dias,
        unidades_vendidas: r.unidades_vendidas,
        demanda_trapecio: r.demanda_trapecio,
        nota: r.nota || null
      };
    }
  },
  {
    roles: ['administrador'],
    definicion: {
      type: 'function',
      name: 'costo_de_compra',
      description:
        'Dice a cómo le llegó (costo de compra) un producto: el costo del último ingreso y el precio de compra actual.',
      parameters: {
        type: 'object',
        properties: {
          producto: { type: 'string', description: 'Nombre del producto.' }
        },
        required: ['producto']
      }
    },
    async ejecutar(args) {
      const buscado = await buscarUnProducto(args.producto);
      if (buscado.error) return buscado;

      const [ingresos] = await pool.query(
        `SELECT costo_und, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha
         FROM movimiento_inventario
         WHERE id_producto = ? AND tipo_movimiento = 'ingreso' AND costo_und IS NOT NULL
         ORDER BY fecha DESC, id_movimiento DESC
         LIMIT 1`,
        [buscado.producto.id_producto]
      );

      return {
        producto: buscado.producto.nombre,
        costo_ultimo_ingreso_pesos: ingresos.length ? Number(ingresos[0].costo_und) : null,
        fecha_ultimo_ingreso: ingresos.length ? ingresos[0].fecha : null,
        precio_compra_actual_pesos: Number(buscado.producto.precio_compra)
      };
    }
  }
];

// ------------------------------------------------------------
// Lo que usa el controlador
// ------------------------------------------------------------

// Devuelve las herramientas del rol y una función para ejecutarlas.
// Aunque Gemini pidiera una herramienta que no es de su rol, aquí se rechaza.
function herramientasParaRol(rol) {
  const permitidas = HERRAMIENTAS.filter((h) => h.roles.includes(rol));

  async function ejecutar(nombre, args) {
    const herramienta = permitidas.find((h) => h.definicion.name === nombre);
    if (!herramienta) {
      return { error: 'Esa información no está disponible para este usuario.' };
    }
    try {
      return await herramienta.ejecutar(args || {});
    } catch (error) {
      console.error(`Error en la herramienta ${nombre}:`, error.message);
      return { error: 'No se pudo consultar la información.' };
    }
  }

  return { definiciones: permitidas.map((h) => h.definicion), ejecutar };
}

module.exports = { herramientasParaRol };