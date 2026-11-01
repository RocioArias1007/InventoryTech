// ============================================================
// productoRutas.js
// Lista de pedidos permitidos para los productos.
// ============================================================

const express = require('express');
const {
  listarProductos,
  crearProducto,
  ingresarMercancia,
  actualizarProducto,
  eliminarProducto,
  subirFoto,
  verFoto,
  eliminarFoto
} = require('../controladores/productoControlador');
const { verificarToken, permitirRoles } = require('../middlewares/autenticacion');
const { TAMANO_MAXIMO_BYTES } = require('../config/foto');
const router = express.Router();

// Guardia que lee la imagen que llega como cuerpo del pedido.
// Rechaza lo que pese más del máximo con un mensaje claro.
function recibirFoto(req, res, next) {
    express.raw({ type: () => true, limit: TAMANO_MAXIMO_BYTES })(req, res, (error) => {
    if (error) {
      if (error.type === 'entity.too.large') {
        return res.status(413).json({ mensaje: 'La foto no puede pesar más de 1 MB.' });
      }
      return res.status(400).json({ mensaje: 'No se pudo leer la foto.' });
    }
    next();
  });
}

// GET /api/productos -> lista de productos con su estado de stock.
// Cualquier usuario con sesión iniciada puede consultarla.
router.get('/', verificarToken, listarProductos);

// POST /api/productos -> crea un producto. Solo el administrador.
router.post('/', verificarToken, permitirRoles('administrador'), crearProducto);

// POST /api/productos/:id/ingreso -> suma unidades que llegaron. Solo el administrador.
router.post('/:id/ingreso', verificarToken, permitirRoles('administrador'), ingresarMercancia);

// PUT /api/productos/:id -> modifica los datos de un producto. Solo el administrador.
router.put('/:id', verificarToken, permitirRoles('administrador'), actualizarProducto);

// DELETE /api/productos/:id -> elimina un producto (borrado lógico). Solo el administrador.
router.delete('/:id', verificarToken, permitirRoles('administrador'), eliminarProducto);

// GET /api/productos/:id/foto -> devuelve la imagen. Cualquier usuario con sesión.
router.get('/:id/foto', verificarToken, verFoto);

// PUT /api/productos/:id/foto -> guarda o reemplaza la foto. Solo el administrador.
// Primero se revisa quién es, y solo después se lee el archivo.
router.put('/:id/foto', verificarToken, permitirRoles('administrador'), recibirFoto, subirFoto);

// DELETE /api/productos/:id/foto -> quita la foto. Solo el administrador.
router.delete('/:id/foto', verificarToken, permitirRoles('administrador'), eliminarFoto);

module.exports = router;