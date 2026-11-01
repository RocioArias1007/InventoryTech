// ============================================================
// chatRutas.js
// El chat de Katia. Lo pueden usar el administrador y el empleado.
// ============================================================

const express = require('express');
const { preguntar } = require('../controladores/chatControlador');
const { verificarToken } = require('../middlewares/autenticacion');

const router = express.Router();

// POST /api/chat -> hace una pregunta a Katia.
router.post('/', verificarToken, preguntar);

module.exports = router;