// ============================================================
// servidor.js
// Enciende el backend de InventoryTech.
// ============================================================

// Carga los secretos del archivo .env (por ejemplo, el puerto).
require('dotenv').config();

// Express es el "teléfono" que recibe los pedidos de la app.
const express = require('express');

// CORS permite que la app (que corre en otra dirección) hable con el backend.
const cors = require('cors');

// La conexión a MySQL.
const pool = require('./config/baseDatos');

// Las rutas de autenticación (login).
const authRutas = require('./rutas/authRutas');

// Las rutas de categorías.
const categoriaRutas = require('./rutas/categoriaRutas');

// Las rutas de productos.
const productoRutas = require('./rutas/productoRutas');

// Las rutas de ventas.
const ventaRutas = require('./rutas/ventaRutas');

// Las rutas del historial (movimientos y auditoría).
const historialRutas = require('./rutas/historialRutas');

// Las rutas de demanda por producto.
const demandaRutas = require('./rutas/demandaRutas');

// Las rutas de usuarios.
const usuarioRutas = require('./rutas/usuarioRutas');

// Las rutas de reportes.
const reporteRutas = require('./rutas/reporteRutas');

// Las rutas del chat de Katia.
const chatRutas = require('./rutas/chatRutas');

// Creamos la aplicación (nuestro servidor).
const app = express();

// Direcciones permitidas, leídas del .env (separadas por comas).
const origenesPermitidos = (process.env.ORIGENES_PERMITIDOS || '')
  .split(',')
  .map((origen) => origen.trim())
  .filter(Boolean);

// CORS: solo las direcciones de la lista pueden usar el backend desde un navegador.
// Sin "origen" (por ejemplo Thunder Client o curl) se deja pasar, porque no es un navegador.
// Esto NO reemplaza al login: lo que protege los datos es el token y el rol.
app.use(cors({
  origin(origen, callback) {
    if (!origen || origenesPermitidos.includes(origen)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600
}));

// Permite que el servidor entienda los datos que llegan en formato JSON.
app.use(express.json());

// Ruta de prueba: sirve para preguntar "¿el backend está vivo?".
app.get('/api/salud', (req, res) => {
  res.json({ mensaje: '¡Hola! El backend de InventoryTech está funcionando.' });
});

// Todos los pedidos que empiecen por /api/auth van a las rutas de autenticación.
app.use('/api/auth', authRutas);

// Todos los pedidos que empiecen por /api/categorias van a las rutas de categorías.
app.use('/api/categorias', categoriaRutas);

// Todos los pedidos que empiecen por /api/productos van a las rutas de productos.
app.use('/api/productos', productoRutas);

// Todos los pedidos que empiecen por /api/ventas van a las rutas de ventas.
app.use('/api/ventas', ventaRutas);

// Todos los pedidos que empiecen por /api/historial van a las rutas del historial.
app.use('/api/historial', historialRutas);

// Todos los pedidos que empiecen por /api/demanda van a las rutas de demanda.
app.use('/api/demanda', demandaRutas);

// Todos los pedidos que empiecen por /api/usuarios van a las rutas de usuarios.
app.use('/api/usuarios', usuarioRutas);

// Todos los pedidos que empiecen por /api/reportes van a las rutas de reportes.
app.use('/api/reportes', reporteRutas);

// Todos los pedidos que empiecen por /api/chat van al chat de Katia.
app.use('/api/chat', chatRutas);

// Puerto por donde atiende el servidor. Si el .env no lo trae, usa el 3000.
const PUERTO = process.env.PUERTO || 3000;

// Primero revisa lo esencial y después enciende el servidor.
async function iniciar() {
  // Sin la tinta secreta no se pueden fabricar manillas, así que no arrancamos.
  if (!process.env.JWT_SECRET) {
    console.error('Falta JWT_SECRET en el archivo .env.');
    process.exit(1);
  }

  try {
    // Cuenta cuántos productos hay en la bodega.
    const [filas] = await pool.query('SELECT COUNT(*) AS total FROM producto');
    console.log(`Conexión a MySQL exitosa. Productos en la base de datos: ${filas[0].total}`);
  } catch (error) {
    // Si algo falla, avisa el motivo y apaga el programa.
    console.error('No se pudo conectar a MySQL:', error.message);
    process.exit(1);
  }

  app.listen(PUERTO, () => {
    console.log(`Servidor encendido en http://localhost:${PUERTO}`);
  });
}

iniciar();