// ============================================================
// baseDatos.js
// Abre la comunicación entre el backend y MySQL (local o en la nube).
// ============================================================

// Carga los secretos del archivo .env.
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// Hora de Colombia: los servidores en la nube trabajan en UTC (5 horas adelante).
const ZONA_COLOMBIA = '-05:00';

// Si el .env trae DB_SSL_CA, la conexión va cifrada y verifica el certificado.
const opcionesSsl = process.env.DB_SSL_CA
  ? { ssl: { ca: fs.readFileSync(path.resolve(process.env.DB_SSL_CA)), rejectUnauthorized: true } }
  : {};

// Pool de conexiones: varias ventanillas abiertas hacia la bodega.
const pool = mysql.createPool({
  host: process.env.DB_HOST,         // dónde está MySQL
  port: process.env.DB_PUERTO,       // la ventanilla de MySQL
  user: process.env.DB_USUARIO,      // el usuario del backend
  password: process.env.DB_CLAVE,    // su contraseña
  database: process.env.DB_NOMBRE,   // la bodega que va a usar
  waitForConnections: true,          // si todas están ocupadas, espera su turno
  connectionLimit: 10,               // máximo de ventanillas abiertas a la vez
  decimalNumbers: true,              // los precios llegan como números y no como texto
  timezone: ZONA_COLOMBIA,           // cómo se leen y escriben las fechas
  ...opcionesSsl
});

// Cada conexión nueva trabaja con la hora de Colombia (CURDATE, NOW, etc.).
pool.pool.on('connection', (conexion) => {
  conexion.query(`SET time_zone = '${ZONA_COLOMBIA}'`);
});

// Deja el pool disponible para los demás archivos.
module.exports = pool;