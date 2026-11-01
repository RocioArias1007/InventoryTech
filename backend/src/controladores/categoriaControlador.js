// ============================================================
// categoriaControlador.js
// Lógica de las categorías de productos.
// ============================================================

// La conexión a MySQL.
const pool = require('../config/baseDatos');

// Herramienta para anotar cambios en la tabla auditoria.
const { registrarAuditoria } = require('../utilidades/auditoria');

// Devuelve la lista de categorías con la cantidad de productos de cada una.
// Acepta una palabra de búsqueda opcional: /api/categorias?buscar=gra
async function listarCategorias(req, res) {
  try {
    // Lee la palabra del buscador (si no llegó, queda vacía y se muestran todas).
    const buscar = typeof req.query.buscar === 'string' ? req.query.buscar.trim() : '';

    // Junta cada categoría con sus productos activos y los cuenta.
    // El ? se llena de forma segura con la palabra de búsqueda.
    const [categorias] = await pool.query(
      `SELECT c.id_categoria, c.nombre, c.descripcion,
              COUNT(p.id_producto) AS total_productos
       FROM categoria c
       LEFT JOIN producto p
         ON p.id_categoria = c.id_categoria AND p.activo = 1
       WHERE c.nombre LIKE ?
       GROUP BY c.id_categoria, c.nombre, c.descripcion
       ORDER BY c.nombre`,
      [`%${buscar}%`]
    );

    return res.json({ categorias });
  } catch (error) {
    // Si algo inesperado falla, lo anotamos en la terminal y avisamos con un mensaje simple.
    console.error('Error al listar categorías:', error.message);
    return res.status(500).json({ mensaje: 'Ocurrió un error en el servidor.' });
  }
}

// Crea una categoría nueva y deja el registro en la auditoría.
async function crearCategoria(req, res) {
  // Lee y limpia los datos que llegaron (quita espacios sobrantes).
  const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.trim() : '';
  const textoDescripcion = typeof req.body?.descripcion === 'string' ? req.body.descripcion.trim() : '';
  // Si la descripción quedó vacía, se guarda como "sin descripción" (NULL).
  const descripcion = textoDescripcion === '' ? null : textoDescripcion;

  // Validaciones: se revisan antes de tocar la base de datos.
  if (nombre === '') {
    return res.status(400).json({ mensaje: 'El nombre de la categoría es obligatorio.' });
  }
  if (nombre.length > 80) {
    return res.status(400).json({ mensaje: 'El nombre no puede tener más de 80 caracteres.' });
  }
  if (descripcion !== null && descripcion.length > 255) {
    return res.status(400).json({ mensaje: 'La descripción no puede tener más de 255 caracteres.' });
  }

  let conexion;
  try {
    // Toma una conexión para la transacción ("todo o nada").
    conexion = await pool.getConnection();
    await conexion.beginTransaction();

    // Guarda la categoría.
    const [resultado] = await conexion.query(
      'INSERT INTO categoria (nombre, descripcion) VALUES (?, ?)',
      [nombre, descripcion]
    );

    // Cómo quedó la categoría.
    const nueva = { id_categoria: resultado.insertId, nombre, descripcion };

    // Anota en la auditoría quién la creó. No hay "valor anterior" porque es nueva.
    await registrarAuditoria(conexion, {
      id_usuario: req.usuario.id_usuario,
      accion: 'crear',
      entidad: 'categoria',
      id_registro: nueva.id_categoria,
      valor_nuevo: nueva
    });

    // Confirma: ahora sí quedan guardados los dos registros.
    await conexion.commit();

    return res.status(201).json({ mensaje: 'Categoría creada.', categoria: nueva });
  } catch (error) {
    // Si algo falló, deshace todo lo que se había hecho.
    if (conexion) await conexion.rollback();

    // ER_DUP_ENTRY significa que ya existe una categoría con ese nombre.
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ mensaje: 'Ya existe una categoría con ese nombre.' });
    }

    console.error('Error al crear categoría:', error.message);
    return res.status(500).json({ mensaje: 'Ocurrió un error en el servidor.' });
  } finally {
    // Devuelve la conexión al pool, pase lo que pase.
    if (conexion) conexion.release();
  }
}

// Actualiza el nombre y/o la descripción de una categoría existente.
async function actualizarCategoria(req, res) {
  // Revisa que el número de la dirección sea un entero positivo (por ejemplo 5, no "abc").
  if (!/^\d+$/.test(req.params.id) || Number(req.params.id) < 1) {
    return res.status(400).json({ mensaje: 'El número de categoría no es válido.' });
  }
  const id = Number(req.params.id);

  // Lee y limpia el nombre (es obligatorio).
  const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.trim() : '';
  if (nombre === '') {
    return res.status(400).json({ mensaje: 'El nombre de la categoría es obligatorio.' });
  }
  if (nombre.length > 80) {
    return res.status(400).json({ mensaje: 'El nombre no puede tener más de 80 caracteres.' });
  }

  // La descripción es opcional. Si no vino en el pedido, se conserva la actual.
  const descripcionEnviada = req.body?.descripcion !== undefined;
  let descripcionNueva = null;
  if (descripcionEnviada) {
    if (req.body.descripcion !== null && typeof req.body.descripcion !== 'string') {
      return res.status(400).json({ mensaje: 'La descripción debe ser texto.' });
    }
    const texto = (req.body.descripcion || '').trim();
    if (texto.length > 255) {
      return res.status(400).json({ mensaje: 'La descripción no puede tener más de 255 caracteres.' });
    }
    // Si quedó vacía, se guarda como "sin descripción" (NULL).
    descripcionNueva = texto === '' ? null : texto;
  }

  let conexion;
  try {
    // Toma una conexión para la transacción ("todo o nada").
    conexion = await pool.getConnection();
    await conexion.beginTransaction();

    // Busca la categoría y la "reserva" (FOR UPDATE) mientras la modificamos.
    const [filas] = await conexion.query(
      'SELECT id_categoria, nombre, descripcion FROM categoria WHERE id_categoria = ? FOR UPDATE',
      [id]
    );

    // Si no existe, no hay nada que actualizar.
    if (filas.length === 0) {
      await conexion.rollback();
      return res.status(404).json({ mensaje: 'La categoría no existe.' });
    }

    // Cómo estaba antes de cambiarla.
    const anterior = {
      id_categoria: filas[0].id_categoria,
      nombre: filas[0].nombre,
      descripcion: filas[0].descripcion
    };

    // Cómo va a quedar: si no mandaron descripción, conserva la anterior.
    const nueva = {
      id_categoria: id,
      nombre,
      descripcion: descripcionEnviada ? descripcionNueva : anterior.descripcion
    };

    // Si nada cambió, no escribimos nada ni dejamos rastro en la auditoría.
    if (nueva.nombre === anterior.nombre && nueva.descripcion === anterior.descripcion) {
      await conexion.rollback();
      return res.json({ mensaje: 'No hubo cambios.', categoria: anterior });
    }

    // Guarda los cambios.
    await conexion.query(
      'UPDATE categoria SET nombre = ?, descripcion = ? WHERE id_categoria = ?',
      [nueva.nombre, nueva.descripcion, id]
    );

    // Anota en la auditoría quién la cambió, cómo estaba antes y cómo quedó.
    await registrarAuditoria(conexion, {
      id_usuario: req.usuario.id_usuario,
      accion: 'modificar',
      entidad: 'categoria',
      id_registro: id,
      valor_anterior: anterior,
      valor_nuevo: nueva
    });

    // Confirma: ahora sí quedan guardados los dos registros.
    await conexion.commit();

    return res.json({ mensaje: 'Categoría actualizada.', categoria: nueva });
  } catch (error) {
    // Si algo falló, deshace todo lo que se había hecho.
    if (conexion) await conexion.rollback();

    // ER_DUP_ENTRY significa que ya existe otra categoría con ese nombre.
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ mensaje: 'Ya existe una categoría con ese nombre.' });
    }

    console.error('Error al actualizar categoría:', error.message);
    return res.status(500).json({ mensaje: 'Ocurrió un error en el servidor.' });
  } finally {
    // Devuelve la conexión al pool, pase lo que pase.
    if (conexion) conexion.release();
  }
}

// Elimina una categoría. Si tiene productos, primero los mueve a otra categoría.
// Uso: DELETE /api/categorias/6?reasignar_a=4
async function eliminarCategoria(req, res) {
  // Revisa que el número de la dirección sea un entero positivo.
  if (!/^\d+$/.test(req.params.id) || Number(req.params.id) < 1) {
    return res.status(400).json({ mensaje: 'El número de categoría no es válido.' });
  }
  const id = Number(req.params.id);

  // La categoría de destino es opcional: solo hace falta si hay productos que mover.
  let destino = null;
  if (req.query.reasignar_a !== undefined) {
    const texto = req.query.reasignar_a;
    if (typeof texto !== 'string' || !/^\d+$/.test(texto) || Number(texto) < 1) {
      return res.status(400).json({ mensaje: 'La categoría de destino no es válida.' });
    }
    destino = Number(texto);
    if (destino === id) {
      return res.status(400).json({
        mensaje: 'No puedes mover los productos a la misma categoría que vas a eliminar.'
      });
    }
  }

  let conexion;
  try {
    // Toma una conexión para la transacción ("todo o nada").
    conexion = await pool.getConnection();
    await conexion.beginTransaction();

    // Busca la categoría y la "reserva" (FOR UPDATE) mientras trabajamos.
    const [filas] = await conexion.query(
      'SELECT id_categoria, nombre, descripcion FROM categoria WHERE id_categoria = ? FOR UPDATE',
      [id]
    );

    // Si no existe, no hay nada que eliminar.
    if (filas.length === 0) {
      await conexion.rollback();
      return res.status(404).json({ mensaje: 'La categoría no existe.' });
    }

    // Cómo era la categoría antes de eliminarla.
    const categoria = {
      id_categoria: filas[0].id_categoria,
      nombre: filas[0].nombre,
      descripcion: filas[0].descripcion
    };

    // Busca TODOS los productos de esta categoría (también los "tachados") y los reserva.
    const [productos] = await conexion.query(
      'SELECT id_producto, nombre FROM producto WHERE id_categoria = ? FOR UPDATE',
      [id]
    );

    if (productos.length > 0) {
      // Hay productos y no dijeron a dónde moverlos: no tocamos nada.
      if (destino === null) {
        await conexion.rollback();
        return res.status(409).json({
          mensaje: `La categoría tiene ${productos.length} producto(s). Elige a qué categoría moverlos antes de eliminarla.`,
          total_productos: productos.length
        });
      }

      // Revisa que la categoría de destino exista.
      const [destinoFilas] = await conexion.query(
        'SELECT id_categoria FROM categoria WHERE id_categoria = ? FOR UPDATE',
        [destino]
      );
      if (destinoFilas.length === 0) {
        await conexion.rollback();
        return res.status(404).json({ mensaje: 'La categoría de destino no existe.' });
      }

      // Mueve todos los productos a la categoría de destino.
      await conexion.query(
        'UPDATE producto SET id_categoria = ? WHERE id_categoria = ?',
        [destino, id]
      );

      // Anota en la auditoría cada producto movido, con su categoría de antes y de después.
      for (const producto of productos) {
        await registrarAuditoria(conexion, {
          id_usuario: req.usuario.id_usuario,
          accion: 'modificar',
          entidad: 'producto',
          id_registro: producto.id_producto,
          valor_anterior: {
            id_producto: producto.id_producto,
            nombre: producto.nombre,
            id_categoria: id
          },
          valor_nuevo: {
            id_producto: producto.id_producto,
            nombre: producto.nombre,
            id_categoria: destino
          }
        });
      }
    }

    // Ahora que la categoría quedó sin productos, se puede eliminar.
    await conexion.query('DELETE FROM categoria WHERE id_categoria = ?', [id]);

    // Anota en la auditoría quién la eliminó. No hay "valor nuevo" porque ya no existe.
    await registrarAuditoria(conexion, {
      id_usuario: req.usuario.id_usuario,
      accion: 'eliminar',
      entidad: 'categoria',
      id_registro: id,
      valor_anterior: categoria
    });

    // Confirma: ahora sí quedan guardados todos los cambios.
    await conexion.commit();

    const movidos = productos.length;
    return res.json({
      mensaje: movidos > 0
        ? `Categoría eliminada. Se movieron ${movidos} producto(s) a la categoría de destino.`
        : 'Categoría eliminada.',
      productos_reasignados: movidos
    });
  } catch (error) {
    // Si algo falló, deshace todo lo que se había hecho.
    if (conexion) await conexion.rollback();

    console.error('Error al eliminar categoría:', error.message);
    return res.status(500).json({ mensaje: 'Ocurrió un error en el servidor.' });
  } finally {
    // Devuelve la conexión al pool, pase lo que pase.
    if (conexion) conexion.release();
  }
}

module.exports = {
  listarCategorias,
  crearCategoria,
  actualizarCategoria,
  eliminarCategoria
};