// ============================================================
// reporteRutas.js
// Lista de pedidos permitidos para los reportes.
// Todo es solo para el administrador.
// ============================================================

const express = require('express');
const { resumenPanel, stockBajo, rentabilidad } = require('../controladores/reporteControlador');
const { verificarToken, permitirRoles } = require('../middlewares/autenticacion');

const router = express.Router();

// Estos dos guardias se aplican a TODAS las rutas de este archivo:
// primero revisa quién es, y luego que sea administrador.
router.use(verificarToken, permitirRoles('administrador'));

// GET /api/reportes/resumen -> los dos datos del panel (stock bajo y ventas de hoy).
router.get('/resumen', resumenPanel);

// GET /api/reportes/stock-bajo -> productos agotados o en su stock mínimo.
router.get('/stock-bajo', stockBajo);

// GET /api/reportes/rentabilidad -> ventas, costo y ganancia por producto.
router.get('/rentabilidad', rentabilidad);

module.exports = router;