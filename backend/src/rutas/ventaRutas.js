// ============================================================
// ventaRutas.js
// Lista de pedidos permitidos para las ventas.
// ============================================================

const express = require('express');
const { registrarVenta, listarVentas } = require('../controladores/ventaControlador');
const { verificarToken, permitirRoles } = require('../middlewares/autenticacion');

const router = express.Router();

// POST /api/ventas -> registra una venta.
// Pueden venderla tanto el empleado como el administrador.
router.post('/', verificarToken, registrarVenta);

// GET /api/ventas -> consulta las ventas de un rango de fechas. Solo el administrador.
router.get('/', verificarToken, permitirRoles('administrador'), listarVentas);

module.exports = router;