// ============================================================
// authControlador.js
// Lógica del login: revisa usuario y contraseña y entrega el token.
// ============================================================

// bcryptjs compara la contraseña escrita con el "sello" guardado.
const bcrypt = require('bcryptjs');

// jsonwebtoken fabrica las "manillas" (tokens).
const jwt = require('jsonwebtoken');

// La conexión a MySQL.
const pool = require('../config/baseDatos');

// Mensaje único para cualquier fallo, así no revelamos qué usuarios existen.
const MENSAJE_ERROR = 'Usuario o contraseña incorrectos.';

async function login(req, res) {
  try {
    // Lee los datos que llegaron en el pedido (si no llegó nada, usa un objeto vacío).
    const { usuario, contrasena } = req.body || {};

    // Revisa que ambos datos existan y sean texto.
    if (typeof usuario !== 'string' || typeof contrasena !== 'string' || !usuario || !contrasena) {
      return res.status(400).json({ mensaje: 'Escribe tu usuario y tu contraseña.' });
    }

    // Busca el usuario en la base de datos. El ? se llena de forma segura.
    const [filas] = await pool.query(
      `SELECT id_usuario, nombre, apellidos, usuario, contrasena, rol, activo
       FROM usuario
       WHERE usuario = ?`,
      [usuario]
    );

    // Si no existe, o está "eliminado" (activo = 0), no entra.
    if (filas.length === 0 || !filas[0].activo) {
      return res.status(401).json({ mensaje: MENSAJE_ERROR });
    }

    const persona = filas[0];

    // Compara la contraseña escrita con el sello guardado.
    const coincide = await bcrypt.compare(contrasena, persona.contrasena);
    if (!coincide) {
      return res.status(401).json({ mensaje: MENSAJE_ERROR });
    }

    // Fabrica la manilla: lleva el número y el rol, y vence en 8 horas.
    const token = jwt.sign(
      { id_usuario: persona.id_usuario, rol: persona.rol },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Responde con la manilla y los datos básicos (nunca la contraseña).
    return res.json({
      token,
      usuario: {
        id_usuario: persona.id_usuario,
        nombre: persona.nombre,
        apellidos: persona.apellidos,
        usuario: persona.usuario,
        rol: persona.rol
      }
    });
  } catch (error) {
    // Si algo inesperado falla, lo anotamos en la terminal y avisamos con un mensaje simple.
    console.error('Error en el login:', error.message);
    return res.status(500).json({ mensaje: 'Ocurrió un error en el servidor.' });
  }
}

module.exports = { login };