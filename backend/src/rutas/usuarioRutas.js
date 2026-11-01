// ============================================================
// usuarioRutas.js
// Lista de pedidos permitidos para los usuarios.
// Todo es solo para el administrador.
// ============================================================

const express = require('express');
const {
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  eliminarUsuario
} = require('../controladores/usuarioControlador');
const { verificarToken, permitirRoles } = require('../middlewares/autenticacion');

const router = express.Router();

// Estos dos guardias se aplican a TODAS las rutas de este archivo:
// primero revisa quién es, y luego que sea administrador.
router.use(verificarToken, permitirRoles('administrador'));

// GET /api/usuarios -> lista de usuarios, con buscador opcional.
router.get('/', listarUsuarios);

// POST /api/usuarios -> registra un usuario nuevo.
router.post('/', crearUsuario);

// PUT /api/usuarios/:id -> actualiza los datos de un usuario.
router.put('/:id', actualizarUsuario);

// DELETE /api/usuarios/:id -> elimina un usuario (borrado lógico).
router.delete('/:id', eliminarUsuario);

module.exports = router;