// ============================================================
// demandaRutas.js
// Lista de pedidos permitidos para la demanda por producto.
// ============================================================

const express = require('express');
const { demandaProducto } = require('../controladores/demandaControlador');
const { verificarToken, permitirRoles } = require('../middlewares/autenticacion');

const router = express.Router();

// GET /api/demanda -> demanda de un producto en un rango de fechas. Solo el administrador.
router.get('/', verificarToken, permitirRoles('administrador'), demandaProducto);

module.exports = router;