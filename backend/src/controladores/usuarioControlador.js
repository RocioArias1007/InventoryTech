// ============================================================
// usuarioControlador.js
// Lógica de los usuarios del sistema (administradores y empleados).
// ============================================================

// bcryptjs hace el "sello" (hash) de la contraseña.
const bcrypt = require('bcryptjs');

// La conexión a MySQL.
const pool = require('../config/baseDatos');

// Herramienta para anotar cambios en la tabla auditoria.
const { registrarAuditoria } = require('../utilidades/auditoria');

// Funciones comunes.
const { vino } = require('../utilidades/comunes');

// Mensajes para cuando el nombre de usuario o el correo ya existen.
const MENSAJE_USUARIO_REPETIDO = 'Ya existe un usuario con ese nombre de usuario (puede ser de un usuario eliminado).';
const MENSAJE_CORREO_REPETIDO = 'Ya existe un usuario con ese correo electrónico (puede ser de un usuario eliminado).';

// ------------------------------------------------------------
// Funciones auxiliares
// ------------------------------------------------------------

// Revisa los datos de un usuario (sin la contraseña).
// Devuelve { error: 'mensaje' } si algo está mal, o { datos: {...} } si todo está bien.
function validarCamposUsuario(cuerpo) {
  // Nombre y apellidos: obligatorios.
  const nombre = typeof cuerpo.nombre === 'string' ? cuerpo.nombre.trim() : '';
  if (nombre === '') {
    return { error: 'El nombre es obligatorio.' };
  }
  if (nombre.length > 60) {
    return { error: 'El nombre no puede tener más de 60 caracteres.' };
  }

  const apellidos = typeof cuerpo.apellidos === 'string' ? cuerpo.apellidos.trim() : '';
  if (apellidos === '') {
    return { error: 'Los apellidos son obligatorios.' };
  }
  if (apellidos.length > 80) {
    return { error: 'Los apellidos no pueden tener más de 80 caracteres.' };
  }

  // Nombre de usuario (el del login): de 3 a 40 caracteres, sin espacios ni tildes.
  const usuario = typeof cuerpo.usuario === 'string' ? cuerpo.usuario.trim() : '';
  if (!/^[A-Za-z0-9._-]{3,40}$/.test(usuario)) {
    return {
      error: 'El nombre de usuario debe tener de 3 a 40 caracteres: letras sin tildes, números, punto, guion o guion bajo.'
    };
  }

  // Correo: obligatorio, con formato válido. Se guarda en minúsculas.
  const correo = typeof cuerpo.correo === 'string' ? cuerpo.correo.trim().toLowerCase() : '';
  if (correo === '') {
    return { error: 'El correo electrónico es obligatorio.' };
  }
  if (correo.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    return { error: 'El correo electrónico no es válido.' };
  }

  // Teléfono: opcional. Se limpian espacios y guiones, y deben quedar de 7 a 15 dígitos.
  let telefono = null;
  if (vino(cuerpo.telefono)) {
    if (typeof cuerpo.telefono !== 'string' && typeof cuerpo.telefono !== 'number') {
      return { error: 'El teléfono no es válido.' };
    }
    const limpio = String(cuerpo.telefono).replace(/[\s-]/g, '');
    if (!/^\+?\d{7,15}$/.test(limpio)) {
      return { error: 'El teléfono debe tener entre 7 y 15 dígitos.' };
    }
    telefono = limpio;
  }

  // Rol: solo los dos roles del proyecto (lista blanca).
  if (cuerpo.rol !== 'administrador' && cuerpo.rol !== 'empleado') {
    return { error: 'El rol debe ser "administrador" o "empleado".' };
  }

  return { datos: { nombre, apellidos, usuario, correo, telefono, rol: cuerpo.rol } };
}

// Revisa la contraseña. Devuelve un mensaje de error, o null si está bien.
// No se le quitan los espacios: la contraseña se guarda tal cual la escribió la persona.
function validarContrasena(contrasena) {
  if (typeof contrasena !== 'string' || contrasena === '') {
    return 'La contraseña es obligatoria.';
  }
  if (contrasena.length < 8) {
    return 'La contraseña debe tener mínimo 8 caracteres.';
  }
  // La herramienta de encriptación solo lee los primeros 72 bytes.
  if (Buffer.byteLength(contrasena, 'utf8') > 72) {
    return 'La contraseña no puede superar 72 caracteres.';
  }
  return null;
}

// Reserva (FOR UPDATE) a todos los administradores activos, siempre en el mismo orden,
// y devuelve cuántos son. Sirve para que dos cambios al mismo tiempo no dejen el sistema
// sin administradores, y para que no se traben entre sí.
async function reservarAdministradores(conexion) {
  const [administradores] = await conexion.query(
    `SELECT id_usuario
     FROM usuario
     WHERE rol = 'administrador' AND activo = 1
     ORDER BY id_usuario
     FOR UPDATE`
  );
  return administradores.length;
}

// ------------------------------------------------------------
// Listar usuarios
// ------------------------------------------------------------

// Devuelve los usuarios activos. Nunca incluye la contraseña.
// Buscador opcional: /api/usuarios?buscar=ana (mira nombre, apellidos, usuario y correo)
async function listarUsuarios(req, res) {
  try {
    // Lee la palabra del buscador (si no llegó, queda vacía y se muestran todos).
    const buscar = typeof req.query.buscar === 'string' ? req.query.buscar.trim() : '';

    // Junta nombre, apellidos, usuario y correo en un solo texto y busca la palabra ahí.
    // MySQL ignora mayúsculas y tildes al comparar.
    const [usuarios] = await pool.query(
      `SELECT id_usuario, nombre, apellidos, usuario, correo, telefono, rol
       FROM usuario
       WHERE activo = 1
         AND CONCAT_WS(' ', nombre, apellidos, usuario, correo) LIKE ?
       ORDER BY nombre, apellidos, id_usuario`,
      [`%${buscar}%`]
    );

    return res.json({ usuarios });
  } catch (error) {
    // Si algo inesperado falla, lo anotamos en la terminal y avisamos con un mensaje simple.
    console.error('Error al listar usuarios:', error.message);
    return res.status(500).json({ mensaje: 'Ocurrió un error en el servidor.' });
  }
}

// ------------------------------------------------------------
// Crear usuario
// ------------------------------------------------------------

// Registra un usuario nuevo con la contraseña encriptada.
async function crearUsuario(req, res) {
  const cuerpo = req.body || {};

  // Revisa los datos y la contraseña antes de tocar la base de datos.
  const validacion = validarCamposUsuario(cuerpo);
  if (validacion.error) {
    return res.status(400).json({ mensaje: validacion.error });
  }
  const errorContrasena = validarContrasena(cuerpo.contrasena);
  if (errorContrasena) {
    return res.status(400).json({ mensaje: errorContrasena });
  }
  const { nombre, apellidos, usuario, correo, telefono, rol } = validacion.datos;

  let conexion;
  try {
    // Hace el "sello" de la contraseña. Se hace antes de abrir la transacción
    // porque es un proceso lento a propósito, y no queremos tener la base de datos ocupada.
    const hash = await bcrypt.hash(cuerpo.contrasena, 10);

    // Toma una conexión para la transacción ("todo o nada").
    conexion = await pool.getConnection();
    await conexion.beginTransaction();

    // Guarda el usuario (queda activo automáticamente).
    const [resultado] = await conexion.query(
      `INSERT INTO usuario (nombre, apellidos, usuario, correo, contrasena, telefono, rol)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [nombre, apellidos, usuario, correo, hash, telefono, rol]
    );

    // Cómo quedó el usuario. Sin contraseña, ni siquiera encriptada.
    const nuevo = {
      id_usuario: resultado.insertId,
      nombre,
      apellidos,
      usuario,
      correo,
      telefono,
      rol
    };

    // Anota en la auditoría quién lo creó. No hay "valor anterior" porque es nuevo.
    await registrarAuditoria(conexion, {
      id_usuario: req.usuario.id_usuario,
      accion: 'crear',
      entidad: 'usuario',
      id_registro: nuevo.id_usuario,
      valor_nuevo: nuevo
    });

    // Confirma: ahora sí quedan guardados los dos registros.
    await conexion.commit();

    return res.status(201).json({ mensaje: 'Usuario creado.', usuario: nuevo });
  } catch (error) {
    // Si algo falló, deshace todo lo que se había hecho.
    if (conexion) await conexion.rollback();

    // ER_DUP_ENTRY significa que ya existe ese correo o ese nombre de usuario.
    if (error.code === 'ER_DUP_ENTRY') {
      if (String(error.message).includes('uq_usuario_correo')) {
        return res.status(409).json({ mensaje: MENSAJE_CORREO_REPETIDO });
      }
      return res.status(409).json({ mensaje: MENSAJE_USUARIO_REPETIDO });
    }

    console.error('Error al crear usuario:', error.message);
    return res.status(500).json({ mensaje: 'Ocurrió un error en el servidor.' });
  } finally {
    // Devuelve la conexión al pool, pase lo que pase.
    if (conexion) conexion.release();
  }
}

// ------------------------------------------------------------
// Actualizar usuario
// ------------------------------------------------------------

// Cambia los datos de un usuario existente. La contraseña es opcional:
// si no viene (o viene vacía), se conserva la actual.
// Uso: PUT /api/usuarios/5
async function actualizarUsuario(req, res) {
  // Revisa que el número de la dirección sea un entero positivo.
  if (!/^\d+$/.test(req.params.id) || Number(req.params.id) < 1) {
    return res.status(400).json({ mensaje: 'El número de usuario no es válido.' });
  }
  const id = Number(req.params.id);
  const cuerpo = req.body || {};

  // Revisa los datos antes de tocar la base de datos.
  const validacion = validarCamposUsuario(cuerpo);
  if (validacion.error) {
    return res.status(400).json({ mensaje: validacion.error });
  }
  const datos = validacion.datos;

  // La contraseña solo se revisa si vino una nueva.
  const cambiaContrasena = vino(cuerpo.contrasena);
  if (cambiaContrasena) {
    const errorContrasena = validarContrasena(cuerpo.contrasena);
    if (errorContrasena) {
      return res.status(400).json({ mensaje: errorContrasena });
    }
  }

  let conexion;
  try {
    // Hace el "sello" de la contraseña nueva (si la hay) antes de abrir la transacción.
    const hash = cambiaContrasena ? await bcrypt.hash(cuerpo.contrasena, 10) : null;

    // Toma una conexión para la transacción ("todo o nada").
    conexion = await pool.getConnection();
    await conexion.beginTransaction();

    // Reserva a los administradores y después al usuario que vamos a cambiar.
    const administradoresActivos = await reservarAdministradores(conexion);
    const [filas] = await conexion.query(
      `SELECT id_usuario, nombre, apellidos, usuario, correo, telefono, rol
       FROM usuario
       WHERE id_usuario = ? AND activo = 1
       FOR UPDATE`,
      [id]
    );

    // Si no existe (o fue eliminado), no hay nada que actualizar.
    if (filas.length === 0) {
      await conexion.rollback();
      return res.status(404).json({ mensaje: 'El usuario no existe.' });
    }
    const actual = filas[0];

    // Un administrador no puede cambiar su propio rol.
    if (id === req.usuario.id_usuario && datos.rol !== actual.rol) {
      await conexion.rollback();
      return res.status(409).json({ mensaje: 'No puedes cambiar tu propio rol.' });
    }

    // Nunca se puede dejar el sistema sin administradores.
    if (actual.rol === 'administrador' && datos.rol === 'empleado' && administradoresActivos <= 1) {
      await conexion.rollback();
      return res.status(409).json({ mensaje: 'No se puede dejar el sistema sin administradores.' });
    }

    // Cómo estaba antes y cómo va a quedar (sin contraseña).
    const anterior = {
      id_usuario: id,
      nombre: actual.nombre,
      apellidos: actual.apellidos,
      usuario: actual.usuario,
      correo: actual.correo,
      telefono: actual.telefono,
      rol: actual.rol
    };
    const nuevo = {
      id_usuario: id,
      nombre: datos.nombre,
      apellidos: datos.apellidos,
      usuario: datos.usuario,
      correo: datos.correo,
      telefono: datos.telefono,
      rol: datos.rol
    };

    // Si nada cambió (ni los datos ni la contraseña), no escribimos nada.
    if (JSON.stringify(anterior) === JSON.stringify(nuevo) && !cambiaContrasena) {
      await conexion.rollback();
      return res.json({ mensaje: 'No hubo cambios.', usuario: anterior });
    }

    // Guarda los cambios. La contraseña solo se toca si vino una nueva.
    if (cambiaContrasena) {
      await conexion.query(
        `UPDATE usuario
         SET nombre = ?, apellidos = ?, usuario = ?, correo = ?, telefono = ?, rol = ?, contrasena = ?
         WHERE id_usuario = ?`,
        [nuevo.nombre, nuevo.apellidos, nuevo.usuario, nuevo.correo, nuevo.telefono, nuevo.rol, hash, id]
      );
    } else {
      await conexion.query(
        `UPDATE usuario
         SET nombre = ?, apellidos = ?, usuario = ?, correo = ?, telefono = ?, rol = ?
         WHERE id_usuario = ?`,
        [nuevo.nombre, nuevo.apellidos, nuevo.usuario, nuevo.correo, nuevo.telefono, nuevo.rol, id]
      );
    }

    // Anota en la auditoría. La contraseña NUNCA se guarda: solo la marca de que cambió.
    await registrarAuditoria(conexion, {
      id_usuario: req.usuario.id_usuario,
      accion: 'modificar',
      entidad: 'usuario',
      id_registro: id,
      valor_anterior: anterior,
      valor_nuevo: cambiaContrasena ? { ...nuevo, contrasena_cambiada: true } : nuevo
    });

    // Confirma: ahora sí quedan guardados los dos registros.
    await conexion.commit();

    return res.json({ mensaje: 'Usuario actualizado.', usuario: nuevo });
  } catch (error) {
    // Si algo falló, deshace todo lo que se había hecho.
    if (conexion) await conexion.rollback();

    // ER_DUP_ENTRY significa que ya existe ese correo o ese nombre de usuario en otra persona.
    if (error.code === 'ER_DUP_ENTRY') {
      if (String(error.message).includes('uq_usuario_correo')) {
        return res.status(409).json({ mensaje: MENSAJE_CORREO_REPETIDO });
      }
      return res.status(409).json({ mensaje: MENSAJE_USUARIO_REPETIDO });
    }

    console.error('Error al actualizar usuario:', error.message);
    return res.status(500).json({ mensaje: 'Ocurrió un error en el servidor.' });
  } finally {
    // Devuelve la conexión al pool, pase lo que pase.
    if (conexion) conexion.release();
  }
}

// ------------------------------------------------------------
// Eliminar usuario (borrado lógico)
// ------------------------------------------------------------

// "Elimina" un usuario marcándolo como inactivo (activo = 0). La fila NO se borra:
// así sus ventas, movimientos y auditorías conservan su dueño.
// Desde ese momento no puede iniciar sesión, ni siquiera con una manilla (token) vigente.
// Uso: DELETE /api/usuarios/5
async function eliminarUsuario(req, res) {
  // Revisa que el número de la dirección sea un entero positivo.
  if (!/^\d+$/.test(req.params.id) || Number(req.params.id) < 1) {
    return res.status(400).json({ mensaje: 'El número de usuario no es válido.' });
  }
  const id = Number(req.params.id);

  // Nadie puede eliminarse a sí mismo.
  if (id === req.usuario.id_usuario) {
    return res.status(409).json({ mensaje: 'No puedes eliminar tu propio usuario.' });
  }

  let conexion;
  try {
    // Toma una conexión para la transacción ("todo o nada").
    conexion = await pool.getConnection();
    await conexion.beginTransaction();

    // Reserva a los administradores y después al usuario que vamos a eliminar.
    const administradoresActivos = await reservarAdministradores(conexion);
    const [filas] = await conexion.query(
      `SELECT id_usuario, nombre, apellidos, usuario, correo, telefono, rol
       FROM usuario
       WHERE id_usuario = ? AND activo = 1
       FOR UPDATE`,
      [id]
    );

    // Si no existe (o ya fue eliminado), no hay nada que hacer.
    if (filas.length === 0) {
      await conexion.rollback();
      return res.status(404).json({ mensaje: 'El usuario no existe.' });
    }
    const actual = filas[0];

    // Nunca se puede dejar el sistema sin administradores.
    if (actual.rol === 'administrador' && administradoresActivos <= 1) {
      await conexion.rollback();
      return res.status(409).json({ mensaje: 'No se puede dejar el sistema sin administradores.' });
    }

    // Lo "tacha": queda guardado, pero ya no puede entrar a la app.
    await conexion.query('UPDATE usuario SET activo = 0 WHERE id_usuario = ?', [id]);

    // Anota en la auditoría quién lo eliminó y cómo era el usuario (sin contraseña).
    // No hay "valor nuevo" porque ya no está activo.
    await registrarAuditoria(conexion, {
      id_usuario: req.usuario.id_usuario,
      accion: 'eliminar',
      entidad: 'usuario',
      id_registro: id,
      valor_anterior: {
        id_usuario: id,
        nombre: actual.nombre,
        apellidos: actual.apellidos,
        usuario: actual.usuario,
        correo: actual.correo,
        telefono: actual.telefono,
        rol: actual.rol
      }
    });

    // Confirma: ahora sí quedan guardados los dos registros.
    await conexion.commit();

    return res.json({ mensaje: 'Usuario eliminado. Ya no podrá iniciar sesión.' });
  } catch (error) {
    // Si algo falló, deshace todo lo que se había hecho.
    if (conexion) await conexion.rollback();

    console.error('Error al eliminar usuario:', error.message);
    return res.status(500).json({ mensaje: 'Ocurrió un error en el servidor.' });
  } finally {
    // Devuelve la conexión al pool, pase lo que pase.
    if (conexion) conexion.release();
  }
}

module.exports = { listarUsuarios, crearUsuario, actualizarUsuario, eliminarUsuario };