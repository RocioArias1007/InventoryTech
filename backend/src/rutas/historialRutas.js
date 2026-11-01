// ============================================================
// historialRutas.js
// Lista de pedidos permitidos para consultar el historial.
// Todo es solo para el administrador.
// ============================================================

const express = require('express');
const { listarMovimientos, listarAuditoria } = require('../controladores/historialControlador');
const { verificarToken, permitirRoles } = require('../middlewares/autenticacion');

const router = express.Router();

// Estos dos guardias se aplican a TODAS las rutas de este archivo:
// primero revisa quién es, y luego que sea administrador.
router.use(verificarToken, permitirRoles('administrador'));

// GET /api/historial/movimientos -> entradas y salidas de mercancía.
router.get('/movimientos', listarMovimientos);

// GET /api/historial/auditoria -> quién hizo qué cambio.
router.get('/auditoria', listarAuditoria);

module.exports = router;