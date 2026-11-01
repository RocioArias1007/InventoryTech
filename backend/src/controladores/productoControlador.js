// ============================================================
// productoControlador.js
// Lógica de los productos del inventario.
// ============================================================

// La conexión a MySQL.
const pool = require('../config/baseDatos');

// Herramienta para anotar cambios en la tabla auditoria.
const { registrarAuditoria } = require('../utilidades/auditoria');

// Reglas de las fotos (tipos permitidos y tamaño máximo).
const { TIPOS_IMAGEN, TAMANO_MAXIMO_BYTES } = require('../config/foto');

// Funciones comunes (convertir números, estado de stock).
const { aNumero, maximoDosDecimales, vino, calcularEstado } = require('../utilidades/comunes');

// Revisa los datos de un producto. La usan "crear" y "actualizar".
// Devuelve { error: 'mensaje' } si algo está mal,
// o { datos: {...} } si todo está bien.
// Los campos opcionales (descripcion, stockMinimo, iva) quedan en
// undefined si no vinieron, y cada pedido decide qué hacer en ese caso.
function validarCamposProducto(cuerpo) {
  // Nombre: obligatorio.
  const nombre = typeof cuerpo.nombre === 'string' ? cuerpo.nombre.trim() : '';
  if (nombre === '') {
    return { error: 'El nombre del producto es obligatorio.' };
  }
  if (nombre.length > 120) {
    return { error: 'El nombre no puede tener más de 120 caracteres.' };
  }

  // Categoría: obligatoria, un número entero positivo.
  const idCategoria = aNumero(cuerpo.id_categoria);
  if (idCategoria === null || !Number.isInteger(idCategoria) || idCategoria < 1) {
    return { error: 'Elige una categoría válida.' };
  }

  // Descripción: opcional. Si llega vacía, queda como "sin descripción" (null).
  let descripcion;
  if (cuerpo.descripcion !== undefined) {
    if (cuerpo.descripcion !== null && typeof cuerpo.descripcion !== 'string') {
      return { error: 'La descripción debe ser texto.' };
    }
    const texto = (cuerpo.descripcion || '').trim();
    if (texto.length > 255) {
      return { error: 'La descripción no puede tener más de 255 caracteres.' };
    }
    descripcion = texto === '' ? null : texto;
  }

  // Stock mínimo: opcional, entero de 0 a 1.000.000.
  let stockMinimo;
  if (vino(cuerpo.stock_minimo)) {
    stockMinimo = aNumero(cuerpo.stock_minimo);
    if (stockMinimo === null || !Number.isInteger(stockMinimo) || stockMinimo < 0 || stockMinimo > 1000000) {
      return { error: 'El stock mínimo debe ser un número entero entre 0 y 1.000.000.' };
    }
  }

  // Precios: obligatorios, de 0 a 100.000.000, con máximo 2 decimales.
  const precioCompra = aNumero(cuerpo.precio_compra);
  if (precioCompra === null || precioCompra < 0 || precioCompra > 100000000 || !maximoDosDecimales(precioCompra)) {
    return { error: 'El precio de compra debe ser un valor entre 0 y 100.000.000, con máximo 2 decimales.' };
  }
  const precioVenta = aNumero(cuerpo.precio_venta);
  if (precioVenta === null || precioVenta < 0 || precioVenta > 100000000 || !maximoDosDecimales(precioVenta)) {
    return { error: 'El precio de venta debe ser un valor entre 0 y 100.000.000, con máximo 2 decimales.' };
  }

  // IVA: opcional, porcentaje de 0 a 100 con máximo 2 decimales.
  let iva;
  if (vino(cuerpo.iva)) {
    iva = aNumero(cuerpo.iva);
    if (iva === null || iva < 0 || iva > 100 || !maximoDosDecimales(iva)) {
      return { error: 'El IVA debe ser un porcentaje entre 0 y 100.' };
    }
  }

  return { datos: { nombre, idCategoria, descripcion, stockMinimo, precioCompra, precioVenta, iva } };
}

// ------------------------------------------------------------
// Listar productos
// ------------------------------------------------------------

// Devuelve la lista de productos activos con su estado de stock.
// Filtros opcionales: /api/productos?buscar=arr&categoria=1&estado=bajo
async function listarProductos(req, res) {
  try {
    // Reglas de la consulta. Siempre mostramos solo productos activos.
    // Cada filtro que llegue agrega una regla más a esta lista.
    const condiciones = ['p.activo = 1', 'p.nombre LIKE ?'];

    // Lee la palabra del buscador (si no llegó, queda vacía y se muestran todos).
    const buscar = typeof req.query.buscar === 'string' ? req.query.buscar.trim() : '';
    const valores = [`%${buscar}%`];

    // Filtro por categoría: debe ser un número entero positivo.
    if (req.query.categoria !== undefined) {
      const categoria = req.query.categoria;
      if (typeof categoria !== 'string' || !/^\d+$/.test(categoria) || Number(categoria) < 1) {
        return res.status(400).json({ mensaje: 'La categoría no es válida.' });
      }
      condiciones.push('p.id_categoria = ?');
      valores.push(Number(categoria));
    }

    // Filtro por estado: solo aceptamos tres palabras (lista blanca).
    if (req.query.estado !== undefined) {
      const estado = req.query.estado;
      if (estado === 'agotado') {
        condiciones.push('p.cantidad = 0');
      } else if (estado === 'bajo') {
        condiciones.push('p.cantidad > 0 AND p.cantidad <= p.stock_minimo');
      } else if (estado === 'disponible') {
        condiciones.push('p.cantidad > p.stock_minimo');
      } else {
        return res.status(400).json({
          mensaje: 'El estado debe ser "disponible", "bajo" o "agotado".'
        });
      }
    }

    // El precio de compra es un dato de rentabilidad: solo lo ve el administrador.
    const esAdmin = req.usuario.rol === 'administrador';
    const columnaPrecioCompra = esAdmin ? 'p.precio_compra,' : '';

    // Busca los productos junto con el nombre de su categoría.
    // No traemos la foto: solo avisamos si el producto tiene una.
    const [filas] = await pool.query(
      `SELECT p.id_producto, p.nombre, p.descripcion, p.cantidad, p.stock_minimo,
              p.precio_venta, ${columnaPrecioCompra} p.iva,
              p.id_categoria, c.nombre AS categoria,
              (p.foto IS NOT NULL) AS tiene_foto,
              CASE
                WHEN p.cantidad = 0 THEN 'agotado'
                WHEN p.cantidad <= p.stock_minimo THEN 'bajo'
                ELSE 'disponible'
              END AS estado
       FROM producto p
       JOIN categoria c ON c.id_categoria = p.id_categoria
       WHERE ${condiciones.join(' AND ')}
       ORDER BY p.nombre`,
      valores
    );

    // MySQL devuelve 0 o 1 para tiene_foto. Lo convertimos a verdadero o falso.
    const productos = filas.map((fila) => ({ ...fila, tiene_foto: Boolean(fila.tiene_foto) }));

    return res.json({ productos });
  } catch (error) {
    // Si algo inesperado falla, lo anotamos en la terminal y avisamos con un mensaje simple.
    console.error('Error al listar productos:', error.message);
    return res.status(500).json({ mensaje: 'Ocurrió un error en el servidor.' });
  }
}

// ------------------------------------------------------------
// Crear producto
// ------------------------------------------------------------

// Crea un producto nuevo. Si trae unidades iniciales, las anota como un ingreso.
async function crearProducto(req, res) {
  const cuerpo = req.body || {};

  // Revisa los datos comunes (nombre, categoría, precios, etc.).
  const resultadoValidacion = validarCamposProducto(cuerpo);
  if (resultadoValidacion.error) {
    return res.status(400).json({ mensaje: resultadoValidacion.error });
  }
  const { nombre, idCategoria, precioCompra, precioVenta } = resultadoValidacion.datos;

  // Los opcionales que no vinieron toman su valor por defecto.
  const descripcion = resultadoValidacion.datos.descripcion === undefined
    ? null
    : resultadoValidacion.datos.descripcion;
  const stockMinimo = resultadoValidacion.datos.stockMinimo === undefined
    ? 0
    : resultadoValidacion.datos.stockMinimo;
  const iva = resultadoValidacion.datos.iva === undefined
    ? 0
    : resultadoValidacion.datos.iva;

  // Cantidad inicial: opcional, entero de 0 a 1.000.000 (si no viene, 0).
  // Solo existe al crear: después el stock cambia únicamente con ventas e ingresos.
  const cantidad = vino(cuerpo.cantidad) ? aNumero(cuerpo.cantidad) : 0;
  if (cantidad === null || !Number.isInteger(cantidad) || cantidad < 0 || cantidad > 1000000) {
    return res.status(400).json({
      mensaje: 'La cantidad inicial debe ser un número entero entre 0 y 1.000.000.'
    });
  }

  let conexion;
  try {
    // Toma una conexión para la transacción ("todo o nada").
    conexion = await pool.getConnection();
    await conexion.beginTransaction();

    // Revisa que la categoría exista.
    const [categorias] = await conexion.query(
      'SELECT id_categoria FROM categoria WHERE id_categoria = ?',
      [idCategoria]
    );
    if (categorias.length === 0) {
      await conexion.rollback();
      return res.status(404).json({ mensaje: 'La categoría no existe.' });
    }

    // Guarda el producto (queda activo automáticamente y sin foto).
    const [resultado] = await conexion.query(
      `INSERT INTO producto
         (nombre, cantidad, precio_venta, precio_compra, descripcion, stock_minimo, iva, id_categoria)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [nombre, cantidad, precioVenta, precioCompra, descripcion, stockMinimo, iva, idCategoria]
    );
    const idProducto = resultado.insertId;

    // Cómo quedó el producto.
    const nuevo = {
      id_producto: idProducto,
      nombre,
      descripcion,
      cantidad,
      stock_minimo: stockMinimo,
      precio_compra: precioCompra,
      precio_venta: precioVenta,
      iva,
      id_categoria: idCategoria
    };

    // Si nació con unidades, las anotamos como un ingreso (antes había 0).
    if (cantidad > 0) {
      await conexion.query(
        `INSERT INTO movimiento_inventario
           (tipo_movimiento, cantidad, stock_anterior, stock_nuevo, costo_und, id_usuario, id_producto)
         VALUES ('ingreso', ?, 0, ?, ?, ?, ?)`,
        [cantidad, cantidad, precioCompra, req.usuario.id_usuario, idProducto]
      );
    }

    // Anota en la auditoría quién lo creó. No hay "valor anterior" porque es nuevo.
    await registrarAuditoria(conexion, {
      id_usuario: req.usuario.id_usuario,
      accion: 'crear',
      entidad: 'producto',
      id_registro: idProducto,
      valor_nuevo: nuevo
    });

    // Confirma: ahora sí quedan guardados todos los registros.
    await conexion.commit();

    return res.status(201).json({ mensaje: 'Producto creado.', producto: nuevo });
  } catch (error) {
    // Si algo falló, deshace todo lo que se había hecho.
    if (conexion) await conexion.rollback();

    // ER_DUP_ENTRY significa que ya existe un producto con ese nombre.
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ mensaje: 'Ya existe un producto con ese nombre.' });
    }

    // Por si la categoría fue eliminada justo en ese instante.
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(404).json({ mensaje: 'La categoría no existe.' });
    }

    console.error('Error al crear producto:', error.message);
    return res.status(500).json({ mensaje: 'Ocurrió un error en el servidor.' });
  } finally {
    // Devuelve la conexión al pool, pase lo que pase.
    if (conexion) conexion.release();
  }
}

// ------------------------------------------------------------
// Ingreso de mercancía
// ------------------------------------------------------------

// Suma al inventario las unidades que llegaron de un producto.
// Opcionalmente actualiza el precio de compra.
// Uso: POST /api/productos/12/ingreso  con  { "cantidad": 20, "precio_compra": 3900 }
async function ingresarMercancia(req, res) {
  // Revisa que el número de la dirección sea un entero positivo.
  if (!/^\d+$/.test(req.params.id) || Number(req.params.id) < 1) {
    return res.status(400).json({ mensaje: 'El número de producto no es válido.' });
  }
  const id = Number(req.params.id);
  const cuerpo = req.body || {};

  // Unidades que llegaron: obligatorias, entero de 1 a 1.000.000.
  const unidades = aNumero(cuerpo.cantidad);
  if (unidades === null || !Number.isInteger(unidades) || unidades < 1 || unidades > 1000000) {
    return res.status(400).json({
      mensaje: 'Las unidades que llegaron deben ser un número entero entre 1 y 1.000.000.'
    });
  }

  // Nuevo precio de compra: opcional. Si no viene, el precio queda como estaba.
  let nuevoPrecio = null;
  if (vino(cuerpo.precio_compra)) {
    nuevoPrecio = aNumero(cuerpo.precio_compra);
    if (nuevoPrecio === null || nuevoPrecio < 0 || nuevoPrecio > 100000000 || !maximoDosDecimales(nuevoPrecio)) {
      return res.status(400).json({
        mensaje: 'El precio de compra debe ser un valor entre 0 y 100.000.000, con máximo 2 decimales.'
      });
    }
  }

  let conexion;
  try {
    // Toma una conexión para la transacción ("todo o nada").
    conexion = await pool.getConnection();
    await conexion.beginTransaction();

    // Busca el producto activo y lo "reserva" (FOR UPDATE) mientras sumamos.
    const [filas] = await conexion.query(
      `SELECT id_producto, nombre, cantidad, stock_minimo, precio_compra
       FROM producto
       WHERE id_producto = ? AND activo = 1
       FOR UPDATE`,
      [id]
    );

    // Si no existe (o fue eliminado), no hay nada que sumar.
    if (filas.length === 0) {
      await conexion.rollback();
      return res.status(404).json({ mensaje: 'El producto no existe.' });
    }

    const producto = filas[0];

    // La suma la hace el backend: stock de antes + unidades que llegaron.
    const stockAnterior = producto.cantidad;
    const stockNuevo = stockAnterior + unidades;

    // El stock total tampoco puede pasarse del límite.
    if (stockNuevo > 1000000) {
      await conexion.rollback();
      return res.status(400).json({ mensaje: 'El stock total no puede superar 1.000.000 unidades.' });
    }

    // Si no enviaron precio nuevo, se conserva el que ya tenía.
    const precioAnterior = Number(producto.precio_compra);
    const precioFinal = nuevoPrecio === null ? precioAnterior : nuevoPrecio;

    // Guarda el nuevo stock (y el precio de compra).
    await conexion.query(
      'UPDATE producto SET cantidad = ?, precio_compra = ? WHERE id_producto = ?',
      [stockNuevo, precioFinal, id]
    );

    // Anota el ingreso en el cuaderno de entradas y salidas.
    await conexion.query(
      `INSERT INTO movimiento_inventario
         (tipo_movimiento, cantidad, stock_anterior, stock_nuevo, costo_und, id_usuario, id_producto)
       VALUES ('ingreso', ?, ?, ?, ?, ?, ?)`,
      [unidades, stockAnterior, stockNuevo, precioFinal, req.usuario.id_usuario, id]
    );

    // La auditoría solo se escribe si cambió el precio de compra (un dato del producto).
    // Las unidades ya quedaron en movimiento_inventario.
    if (precioFinal !== precioAnterior) {
      await registrarAuditoria(conexion, {
        id_usuario: req.usuario.id_usuario,
        accion: 'modificar',
        entidad: 'producto',
        id_registro: id,
        valor_anterior: { id_producto: id, nombre: producto.nombre, precio_compra: precioAnterior },
        valor_nuevo: { id_producto: id, nombre: producto.nombre, precio_compra: precioFinal }
      });
    }

    // Confirma: ahora sí quedan guardados todos los cambios.
    await conexion.commit();

    return res.json({
      mensaje: `Ingreso registrado. Stock actual: ${stockNuevo}.`,
      producto: {
        id_producto: id,
        nombre: producto.nombre,
        stock_anterior: stockAnterior,
        cantidad: stockNuevo,
        stock_minimo: producto.stock_minimo,
        precio_compra: precioFinal,
        estado: calcularEstado(stockNuevo, producto.stock_minimo)
      }
    });
  } catch (error) {
    // Si algo falló, deshace todo lo que se había hecho.
    if (conexion) await conexion.rollback();

    console.error('Error al registrar el ingreso:', error.message);
    return res.status(500).json({ mensaje: 'Ocurrió un error en el servidor.' });
  } finally {
    // Devuelve la conexión al pool, pase lo que pase.
    if (conexion) conexion.release();
  }
}

// ------------------------------------------------------------
// Actualizar producto
// ------------------------------------------------------------

// Cambia los datos de un producto existente.
// La cantidad NO se puede cambiar aquí: si la envían, se ignora.
// Uso: PUT /api/productos/12
async function actualizarProducto(req, res) {
  // Revisa que el número de la dirección sea un entero positivo.
  if (!/^\d+$/.test(req.params.id) || Number(req.params.id) < 1) {
    return res.status(400).json({ mensaje: 'El número de producto no es válido.' });
  }
  const id = Number(req.params.id);

  // Revisa los datos comunes (nombre, categoría, precios, etc.).
  const resultadoValidacion = validarCamposProducto(req.body || {});
  if (resultadoValidacion.error) {
    return res.status(400).json({ mensaje: resultadoValidacion.error });
  }
  const datos = resultadoValidacion.datos;

  let conexion;
  try {
    // Toma una conexión para la transacción ("todo o nada").
    conexion = await pool.getConnection();
    await conexion.beginTransaction();

    // Busca el producto activo y lo "reserva" (FOR UPDATE) mientras lo modificamos.
    const [filas] = await conexion.query(
      `SELECT id_producto, nombre, descripcion, cantidad, stock_minimo,
              precio_compra, precio_venta, iva, id_categoria
       FROM producto
       WHERE id_producto = ? AND activo = 1
       FOR UPDATE`,
      [id]
    );

    // Si no existe (o fue eliminado), no hay nada que actualizar.
    if (filas.length === 0) {
      await conexion.rollback();
      return res.status(404).json({ mensaje: 'El producto no existe.' });
    }

    const producto = filas[0];

    // Revisa que la categoría elegida exista.
    const [categorias] = await conexion.query(
      'SELECT id_categoria FROM categoria WHERE id_categoria = ?',
      [datos.idCategoria]
    );
    if (categorias.length === 0) {
      await conexion.rollback();
      return res.status(404).json({ mensaje: 'La categoría no existe.' });
    }

    // Cómo estaba antes de cambiarlo (sin la cantidad, que aquí no se toca).
    const anterior = {
      id_producto: id,
      nombre: producto.nombre,
      descripcion: producto.descripcion,
      stock_minimo: producto.stock_minimo,
      precio_compra: Number(producto.precio_compra),
      precio_venta: Number(producto.precio_venta),
      iva: Number(producto.iva),
      id_categoria: producto.id_categoria
    };

    // Cómo va a quedar: lo que no enviaron se conserva igual que antes.
    const nuevo = {
      id_producto: id,
      nombre: datos.nombre,
      descripcion: datos.descripcion === undefined ? anterior.descripcion : datos.descripcion,
      stock_minimo: datos.stockMinimo === undefined ? anterior.stock_minimo : datos.stockMinimo,
      precio_compra: datos.precioCompra,
      precio_venta: datos.precioVenta,
      iva: datos.iva === undefined ? anterior.iva : datos.iva,
      id_categoria: datos.idCategoria
    };

    // Arma la respuesta: los datos del producto más su stock actual y su estado.
    const conStock = (valores) => ({
      ...valores,
      cantidad: producto.cantidad,
      estado: calcularEstado(producto.cantidad, valores.stock_minimo)
    });

    // Si nada cambió, no escribimos nada ni dejamos rastro en la auditoría.
    if (JSON.stringify(anterior) === JSON.stringify(nuevo)) {
      await conexion.rollback();
      return res.json({ mensaje: 'No hubo cambios.', producto: conStock(anterior) });
    }

    // Guarda los cambios. La cantidad no se toca.
    await conexion.query(
      `UPDATE producto
       SET nombre = ?, descripcion = ?, stock_minimo = ?, precio_compra = ?,
           precio_venta = ?, iva = ?, id_categoria = ?
       WHERE id_producto = ?`,
      [
        nuevo.nombre, nuevo.descripcion, nuevo.stock_minimo, nuevo.precio_compra,
        nuevo.precio_venta, nuevo.iva, nuevo.id_categoria, id
      ]
    );

    // Anota en la auditoría quién lo cambió, cómo estaba antes y cómo quedó.
    await registrarAuditoria(conexion, {
      id_usuario: req.usuario.id_usuario,
      accion: 'modificar',
      entidad: 'producto',
      id_registro: id,
      valor_anterior: anterior,
      valor_nuevo: nuevo
    });

    // Confirma: ahora sí quedan guardados los dos registros.
    await conexion.commit();

    return res.json({ mensaje: 'Producto actualizado.', producto: conStock(nuevo) });
  } catch (error) {
    // Si algo falló, deshace todo lo que se había hecho.
    if (conexion) await conexion.rollback();

    // ER_DUP_ENTRY significa que ya existe otro producto con ese nombre.
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ mensaje: 'Ya existe un producto con ese nombre.' });
    }

    // Por si la categoría fue eliminada justo en ese instante.
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(404).json({ mensaje: 'La categoría no existe.' });
    }

    console.error('Error al actualizar producto:', error.message);
    return res.status(500).json({ mensaje: 'Ocurrió un error en el servidor.' });
  } finally {
    // Devuelve la conexión al pool, pase lo que pase.
    if (conexion) conexion.release();
  }
}

// ------------------------------------------------------------
// Eliminar producto (borrado lógico)
// ------------------------------------------------------------

// "Elimina" un producto marcándolo como inactivo (activo = 0).
// La fila NO se borra: así las ventas y movimientos viejos siguen mostrando su nombre.
// Uso: DELETE /api/productos/12
async function eliminarProducto(req, res) {
  // Revisa que el número de la dirección sea un entero positivo.
  if (!/^\d+$/.test(req.params.id) || Number(req.params.id) < 1) {
    return res.status(400).json({ mensaje: 'El número de producto no es válido.' });
  }
  const id = Number(req.params.id);

  let conexion;
  try {
    // Toma una conexión para la transacción ("todo o nada").
    conexion = await pool.getConnection();
    await conexion.beginTransaction();

    // Busca el producto activo y lo "reserva" (FOR UPDATE) mientras lo eliminamos.
    const [filas] = await conexion.query(
      `SELECT id_producto, nombre, descripcion, cantidad, stock_minimo,
              precio_compra, precio_venta, iva, id_categoria
       FROM producto
       WHERE id_producto = ? AND activo = 1
       FOR UPDATE`,
      [id]
    );

    // Si no existe (o ya fue eliminado), no hay nada que hacer.
    if (filas.length === 0) {
      await conexion.rollback();
      return res.status(404).json({ mensaje: 'El producto no existe.' });
    }

    const producto = filas[0];

    // Lo "tacha": queda guardado, pero deja de aparecer y de venderse.
    await conexion.query('UPDATE producto SET activo = 0 WHERE id_producto = ?', [id]);

    // Anota en la auditoría quién lo eliminó y cómo era el producto.
    // No hay "valor nuevo" porque ya no está activo.
    await registrarAuditoria(conexion, {
      id_usuario: req.usuario.id_usuario,
      accion: 'eliminar',
      entidad: 'producto',
      id_registro: id,
      valor_anterior: {
        id_producto: id,
        nombre: producto.nombre,
        descripcion: producto.descripcion,
        cantidad: producto.cantidad,
        stock_minimo: producto.stock_minimo,
        precio_compra: Number(producto.precio_compra),
        precio_venta: Number(producto.precio_venta),
        iva: Number(producto.iva),
        id_categoria: producto.id_categoria
      }
    });

    // Confirma: ahora sí quedan guardados los dos registros.
    await conexion.commit();

    return res.json({
      mensaje: 'Producto eliminado.',
      unidades_restantes: producto.cantidad
    });
  } catch (error) {
    // Si algo falló, deshace todo lo que se había hecho.
    if (conexion) await conexion.rollback();

    console.error('Error al eliminar producto:', error.message);
    return res.status(500).json({ mensaje: 'Ocurrió un error en el servidor.' });
  } finally {
    // Devuelve la conexión al pool, pase lo que pase.
    if (conexion) conexion.release();
  }
}

// ------------------------------------------------------------
// Foto del producto
// ------------------------------------------------------------

// Descubre qué tipo de imagen es un archivo mirando sus primeros bytes ("la firma").
// No le cree a ninguna etiqueta ni al nombre del archivo.
// Devuelve 'image/jpeg', 'image/png', 'image/webp', o null si no es ninguna de las tres.
function detectarTipoImagen(archivo) {
  // JPG: empieza con los bytes FF D8 FF.
  if (archivo.length > 3 && archivo[0] === 0xff && archivo[1] === 0xd8 && archivo[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: empieza con 8 bytes siempre iguales.
  const firmaPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (archivo.length > 8 && archivo.subarray(0, 8).equals(firmaPng)) {
    return 'image/png';
  }

  // WEBP: empieza con la palabra RIFF y, en el byte 8, la palabra WEBP.
  if (
    archivo.length > 12 &&
    archivo.toString('ascii', 0, 4) === 'RIFF' &&
    archivo.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
}

// Guarda (o reemplaza) la foto de un producto.
// Uso: PUT /api/productos/12/foto  con el archivo como cuerpo y Content-Type: image/jpeg
async function subirFoto(req, res) {
  // Revisa que el número de la dirección sea un entero positivo.
  if (!/^\d+$/.test(req.params.id) || Number(req.params.id) < 1) {
    return res.status(400).json({ mensaje: 'El número de producto no es válido.' });
  }
  const id = Number(req.params.id);

    // Revisa que haya llegado un archivo.
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    return res.status(400).json({
      mensaje: 'No llegó ninguna imagen. Adjunta el archivo como cuerpo binario del pedido.'
    });
  }
  const archivo = req.body;

  // Segunda revisión del tamaño, por seguridad.
  if (archivo.length > TAMANO_MAXIMO_BYTES) {
    return res.status(413).json({ mensaje: 'La foto no puede pesar más de 1 MB.' });
  }

  // Descubre el tipo de imagen mirando el contenido del archivo.
  const tipo = detectarTipoImagen(archivo);
  if (!tipo || !TIPOS_IMAGEN.includes(tipo)) {
    return res.status(415).json({ mensaje: 'Envía la foto como una imagen JPG, PNG o WEBP válida.' });
  }

  let conexion;
  try {
    // Toma una conexión para la transacción ("todo o nada").
    conexion = await pool.getConnection();
    await conexion.beginTransaction();

    // Busca el producto activo y lo "reserva". No traemos la foto, solo si tiene una.
    const [filas] = await conexion.query(
      `SELECT id_producto, nombre, (foto IS NOT NULL) AS tiene_foto, foto_tipo
       FROM producto
       WHERE id_producto = ? AND activo = 1
       FOR UPDATE`,
      [id]
    );

    // Si no existe (o fue eliminado), no hay dónde poner la foto.
    if (filas.length === 0) {
      await conexion.rollback();
      return res.status(404).json({ mensaje: 'El producto no existe.' });
    }

    const producto = filas[0];

    // Guarda la imagen y su tipo (reemplaza la anterior si había una).
    await conexion.query(
      'UPDATE producto SET foto = ?, foto_tipo = ? WHERE id_producto = ?',
      [archivo, tipo, id]
    );

    // Anota en la auditoría. NO guardamos la imagen, solo sus datos básicos.
    await registrarAuditoria(conexion, {
      id_usuario: req.usuario.id_usuario,
      accion: 'modificar',
      entidad: 'producto',
      id_registro: id,
      valor_anterior: {
        id_producto: id,
        nombre: producto.nombre,
        tiene_foto: Boolean(producto.tiene_foto),
        foto_tipo: producto.foto_tipo
      },
      valor_nuevo: {
        id_producto: id,
        nombre: producto.nombre,
        tiene_foto: true,
        foto_tipo: tipo,
        tamano_bytes: archivo.length
      }
    });

    // Confirma: ahora sí quedan guardados los dos registros.
    await conexion.commit();

    return res.json({
      mensaje: 'Foto guardada.',
      foto: { tipo, tamano_bytes: archivo.length }
    });
  } catch (error) {
    // Si algo falló, deshace todo lo que se había hecho.
    if (conexion) await conexion.rollback();

    console.error('Error al guardar la foto:', error.message);
    return res.status(500).json({ mensaje: 'Ocurrió un error en el servidor.' });
  } finally {
    // Devuelve la conexión al pool, pase lo que pase.
    if (conexion) conexion.release();
  }
}

// Devuelve la imagen de un producto.
// Uso: GET /api/productos/12/foto
async function verFoto(req, res) {
  // Revisa que el número de la dirección sea un entero positivo.
  if (!/^\d+$/.test(req.params.id) || Number(req.params.id) < 1) {
    return res.status(400).json({ mensaje: 'El número de producto no es válido.' });
  }
  const id = Number(req.params.id);

  try {
    // Trae solo la foto y su tipo del producto activo.
    const [filas] = await pool.query(
      'SELECT foto, foto_tipo FROM producto WHERE id_producto = ? AND activo = 1',
      [id]
    );

    if (filas.length === 0) {
      return res.status(404).json({ mensaje: 'El producto no existe.' });
    }
    if (filas[0].foto === null) {
      return res.status(404).json({ mensaje: 'El producto no tiene foto.' });
    }

    // Responde con la imagen. "nosniff" evita que el navegador intente adivinar otro tipo.
    res.set('Content-Type', filas[0].foto_tipo);
    res.set('X-Content-Type-Options', 'nosniff');
    return res.send(filas[0].foto);
  } catch (error) {
    console.error('Error al leer la foto:', error.message);
    return res.status(500).json({ mensaje: 'Ocurrió un error en el servidor.' });
  }
}

// Quita la foto de un producto (el producto sigue existiendo, sin foto).
// Uso: DELETE /api/productos/12/foto
async function eliminarFoto(req, res) {
  // Revisa que el número de la dirección sea un entero positivo.
  if (!/^\d+$/.test(req.params.id) || Number(req.params.id) < 1) {
    return res.status(400).json({ mensaje: 'El número de producto no es válido.' });
  }
  const id = Number(req.params.id);

  let conexion;
  try {
    // Toma una conexión para la transacción ("todo o nada").
    conexion = await pool.getConnection();
    await conexion.beginTransaction();

    // Busca el producto activo y lo "reserva". No traemos la foto, solo si tiene una.
    const [filas] = await conexion.query(
      `SELECT id_producto, nombre, (foto IS NOT NULL) AS tiene_foto, foto_tipo
       FROM producto
       WHERE id_producto = ? AND activo = 1
       FOR UPDATE`,
      [id]
    );

    if (filas.length === 0) {
      await conexion.rollback();
      return res.status(404).json({ mensaje: 'El producto no existe.' });
    }

    const producto = filas[0];

    // Si no tiene foto, no hay nada que quitar.
    if (!producto.tiene_foto) {
      await conexion.rollback();
      return res.status(404).json({ mensaje: 'El producto no tiene foto.' });
    }

    // Deja la foto vacía (NULL).
    await conexion.query(
      'UPDATE producto SET foto = NULL, foto_tipo = NULL WHERE id_producto = ?',
      [id]
    );

    // Anota en la auditoría que se quitó la foto.
    await registrarAuditoria(conexion, {
      id_usuario: req.usuario.id_usuario,
      accion: 'modificar',
      entidad: 'producto',
      id_registro: id,
      valor_anterior: {
        id_producto: id,
        nombre: producto.nombre,
        tiene_foto: true,
        foto_tipo: producto.foto_tipo
      },
      valor_nuevo: {
        id_producto: id,
        nombre: producto.nombre,
        tiene_foto: false
      }
    });

    // Confirma: ahora sí quedan guardados los dos registros.
    await conexion.commit();

    return res.json({ mensaje: 'Foto eliminada.' });
  } catch (error) {
    // Si algo falló, deshace todo lo que se había hecho.
    if (conexion) await conexion.rollback();

    console.error('Error al eliminar la foto:', error.message);
    return res.status(500).json({ mensaje: 'Ocurrió un error en el servidor.' });
  } finally {
    // Devuelve la conexión al pool, pase lo que pase.
    if (conexion) conexion.release();
  }
}

module.exports = {
  listarProductos,
  crearProducto,
  ingresarMercancia,
  actualizarProducto,
  eliminarProducto,
  subirFoto,
  verFoto,
  eliminarFoto
};