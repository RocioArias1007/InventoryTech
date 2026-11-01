// ============================================================
// auditoria.js
// Herramienta para anotar en la tabla auditoria quién hizo qué cambio.
// Se usa dentro de una transacción, así el cambio y su registro
// se guardan juntos o no se guarda ninguno.
// ============================================================

// conexion: la conexión de la transacción en curso.
// datos: quién lo hizo, qué hizo, sobre qué, y cómo estaba antes y después.
async function registrarAuditoria(conexion, datos) {
  const {
    id_usuario,
    accion,          // 'crear', 'modificar' o 'eliminar'
    entidad,         // 'producto', 'categoria' o 'usuario'
    id_registro,     // número del registro que cambió
    valor_anterior = null,
    valor_nuevo = null
  } = datos;

  await conexion.query(
    `INSERT INTO auditoria
       (id_usuario, accion, entidad, id_registro, valor_anterior, valor_nuevo)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      id_usuario,
      accion,
      entidad,
      id_registro,
      // Si hay valor, lo convierte a texto JSON; si no, queda vacío.
      valor_anterior === null ? null : JSON.stringify(valor_anterior),
      valor_nuevo === null ? null : JSON.stringify(valor_nuevo)
    ]
  );
}

module.exports = { registrarAuditoria };