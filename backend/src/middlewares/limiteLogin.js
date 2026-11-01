// ============================================================
// limiteLogin.js
// Frena los intentos repetidos de entrar con contraseñas equivocadas.
// ============================================================

const MAX_FALLOS_USUARIO = 5;      // fallos seguidos por dispositivo y usuario
const MAX_FALLOS_DISPOSITIVO = 30; // fallos en total desde un mismo dispositivo
const VENTANA_MS = 15 * 60 * 1000; // los fallos se cuentan durante 15 minutos
const BLOQUEO_MS = 15 * 60 * 1000; // cuánto dura el bloqueo

// Guarda los fallos de cada clave: { fallos, primero, bloqueadoHasta }
const registros = new Map();

// Devuelve cuántos minutos faltan si la clave está bloqueada; si no, 0.
function minutosDeBloqueo(clave) {
  const r = registros.get(clave);
  if (!r || !r.bloqueadoHasta) return 0;
  const faltan = r.bloqueadoHasta - Date.now();
  if (faltan <= 0) {
    registros.delete(clave);
    return 0;
  }
  return Math.ceil(faltan / 60000);
}

// Anota un fallo y bloquea si se pasó del máximo.
function anotarFallo(clave, maximo) {
  const ahora = Date.now();
  let r = registros.get(clave);
  if (!r || ahora - r.primero > VENTANA_MS) {
    r = { fallos: 0, primero: ahora, bloqueadoHasta: 0 };
  }
  r.fallos += 1;
  if (r.fallos >= maximo) r.bloqueadoHasta = ahora + BLOQUEO_MS;
  registros.set(clave, r);
}

// Limpieza: cada 10 minutos borra los registros viejos para no llenar la memoria.
setInterval(() => {
  const ahora = Date.now();
  for (const [clave, r] of registros) {
    if (ahora - r.primero > VENTANA_MS && (!r.bloqueadoHasta || r.bloqueadoHasta < ahora)) {
      registros.delete(clave);
    }
  }
}, 10 * 60 * 1000).unref();

// La revisión que se pone antes del login.
function limitarLogin(req, res, next) {
  const nombre = String(req.body?.usuario ?? '').toLowerCase().slice(0, 60);
  const claveUsuario = `u:${req.ip}|${nombre}`;
  const claveDispositivo = `i:${req.ip}`;

  // 1. Si ya está bloqueado, no deja ni intentar.
  const minutos = Math.max(minutosDeBloqueo(claveUsuario), minutosDeBloqueo(claveDispositivo));
  if (minutos > 0) {
    return res.status(429).json({
      mensaje: `Demasiados intentos fallidos. Intenta de nuevo en ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}.`
    });
  }

  // 2. Cuando el login termina, anota el fallo o borra el contador.
  res.on('finish', () => {
    if (res.statusCode === 401) {
      anotarFallo(claveUsuario, MAX_FALLOS_USUARIO);
      anotarFallo(claveDispositivo, MAX_FALLOS_DISPOSITIVO);
    } else if (res.statusCode === 200) {
      registros.delete(claveUsuario);
    }
  });

  next();
}

module.exports = { limitarLogin };