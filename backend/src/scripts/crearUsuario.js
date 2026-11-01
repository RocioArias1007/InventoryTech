// ============================================================
// crearUsuario.js
// Herramienta temporal para crear usuarios con la contraseña encriptada.
// Uso: node src/scripts/crearUsuario.js <usuario> <clave> [administrador|empleado]
// ============================================================

// Carga los secretos del archivo .env.
require('dotenv').config();

// bcryptjs hace el "sello" (hash) de la contraseña.
const bcrypt = require('bcryptjs');

// La conexión a MySQL.
const pool = require('../config/baseDatos');

async function crearUsuario() {
  // Lee lo que escribimos en la terminal después del nombre del archivo.
  // Si no escribimos el rol, por defecto será administrador.
  const [usuario, clave, rol = 'administrador'] = process.argv.slice(2);

  // Revisa que no falte ningún dato.
  if (!usuario || !clave) {
    console.error('Faltan datos. Uso: node src/scripts/crearUsuario.js <usuario> <clave> [administrador|empleado]');
    process.exit(1);
  }

  // Solo se permiten los dos roles del proyecto.
  if (rol !== 'administrador' && rol !== 'empleado') {
    console.error('El rol debe ser "administrador" o "empleado".');
    process.exit(1);
  }

  // Una contraseña muy corta es fácil de adivinar.
  if (clave.length < 8) {
    console.error('La contraseña debe tener mínimo 8 caracteres.');
    process.exit(1);
  }

  try {
    // Revisa que no exista ya un usuario con ese nombre.
    const [existentes] = await pool.query(
      'SELECT id_usuario FROM usuario WHERE usuario = ?',
      [usuario]
    );
    if (existentes.length > 0) {
      console.error(`El usuario "${usuario}" ya existe. Elige otro nombre.`);
      process.exit(1);
    }

    // Hace el "sello" de la contraseña (10 = qué tan lento y seguro es el proceso).
    const hash = await bcrypt.hash(clave, 10);

    // Nombre que se mostrará según el rol.
    const nombre = rol === 'administrador' ? 'Administrador' : 'Empleado';

    // Guarda el usuario. Los ? se llenan de forma segura con los datos de la lista.
    const [resultado] = await pool.query(
      `INSERT INTO usuario (nombre, apellidos, usuario, contrasena, telefono, rol)
       VALUES (?, ?, ?, ?, NULL, ?)`,
      [nombre, 'de Prueba', usuario, hash, rol]
    );

    console.log(`Listo. Usuario "${usuario}" creado con rol ${rol} y número ${resultado.insertId}.`);
  } catch (error) {
    console.error('No se pudo crear el usuario:', error.message);
  } finally {
    // Cierra las ventanillas para que el programa termine.
    await pool.end();
  }
}

crearUsuario();