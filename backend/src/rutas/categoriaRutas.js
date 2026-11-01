// ============================================================
// categoriaRutas.js
// Lista de pedidos permitidos para las categorías.
// ============================================================

const express = require('express');
const {
  listarCategorias,
  crearCategoria,
  actualizarCategoria,
  eliminarCategoria
} = require('../controladores/categoriaControlador');
const { verificarToken, permitirRoles } = require('../middlewares/autenticacion');

const router = express.Router();

// GET /api/categorias -> lista de categorías.
// Cualquier usuario con sesión iniciada puede consultarla.
router.get('/', verificarToken, listarCategorias);

// POST /api/categorias -> crea una categoría. Solo el administrador.
router.post('/', verificarToken, permitirRoles('administrador'), crearCategoria);

// PUT /api/categorias/:id -> actualiza una categoría. Solo el administrador.
router.put('/:id', verificarToken, permitirRoles('administrador'), actualizarCategoria);

// DELETE /api/categorias/:id -> elimina una categoría. Solo el administrador.
// Si tiene productos, hay que indicar ?reasignar_a=<número de otra categoría>.
router.delete('/:id', verificarToken, permitirRoles('administrador'), eliminarCategoria);

module.exports = router;