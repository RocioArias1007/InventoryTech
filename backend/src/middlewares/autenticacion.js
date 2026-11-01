// ============================================================
// autenticacion.js
// Los "guardias" del backend: revisan la manilla (token) y el rol.
// ============================================================

// jsonwebtoken revisa que la manilla sea auténtica y no haya vencido.
const jwt = require('jsonwebtoken');

// La conexión a MySQL.
const pool = require('../config/baseDatos');

// Guardia 1: revisa que la persona haya iniciado sesión.
async function verificarToken(req, res, next) {
  try {
    // La manilla llega en el encabezado, con la forma: "Bearer <token>".
    const encabezado = req.headers.authorization || '';
    const [tipo, token] = encabezado.split(' ');

    if (tipo !== 'Bearer' || !token) {
      return res.status(401).json({ mensaje: 'Debes iniciar sesión.' });
    }

    // Revisa que la firma sea verdadera y que no haya vencido.
    let datos;
    try {
      datos = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ mensaje: 'Tu sesión no es válida o ya venció. Inicia sesión de nuevo.' });
    }

    // Vuelve a consultar la base de datos, por si el usuario fue eliminado
    // o le cambiaron el rol después de recibir su manilla.
    const [filas] = await pool.query(
      `SELECT id_usuario, nombre, apellidos, usuario, rol, activo
       FROM usuario
       WHERE id_usuario = ?`,
      [datos.id_usuario]
    );

    if (filas.length === 0 || !filas[0].activo) {
      return res.status(401).json({ mensaje: 'Tu usuario ya no tiene acceso.' });
    }

    // Anota en el pedido quién es la persona, para el resto del backend.
    req.usuario = {
      id_usuario: filas[0].id_usuario,
      nombre: filas[0].nombre,
      apellidos: filas[0].apellidos,
      usuario: filas[0].usuario,
      rol: filas[0].rol
    };

    // "Pase": el pedido continúa hacia la cocina.
    next();
  } catch (error) {
    console.error('Error al verificar el token:', error.message);
    return res.status(500).json({ mensaje: 'Ocurrió un error en el servidor.' });
  }
}

// Guardia 2: revisa que el rol de la persona tenga permiso.
// Se usa así: permitirRoles('administrador')
function permitirRoles(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ mensaje: 'No tienes permiso para hacer esto.' });
    }
    next();
  };
}

module.exports = { verificarToken, permitirRoles };