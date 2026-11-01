// ============================================================
// authRutas.js
// Lista de pedidos permitidos para la autenticación.
// ============================================================

const express = require('express');
const { login } = require('../controladores/authControlador');
const { limitarLogin } = require('../middlewares/limiteLogin');
const { verificarToken } = require('../middlewares/autenticacion');

// Un router es una mini lista de pedidos para un solo tema.
const router = express.Router();

// POST /api/auth/login -> revisa usuario y contraseña (no necesita manilla).
router.post('/login', limitarLogin, login);

// GET /api/auth/yo -> devuelve los datos de quien tiene la sesión iniciada.
// Cualquier usuario con manilla válida puede usarla.
router.get('/yo', verificarToken, (req, res) => {
  res.json({ usuario: req.usuario });
});


module.exports = router;