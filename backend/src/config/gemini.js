// ============================================================
// gemini.js
// Crea (una sola vez) el cliente de Gemini y entrega el nombre del modelo.
// ============================================================

let cliente = null;

// La librería se carga con import() para que funcione en un proyecto CommonJS.
async function obtenerCliente() {
  if (!cliente) {
    const { GoogleGenAI } = await import('@google/genai');
    cliente = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return cliente;
}

function nombreModelo() {
  return process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
}

// Nivel de "pensamiento": "low" es rápido. Se puede probar "minimal" en el .env.
function nivelPensamiento() {
  return process.env.GEMINI_PENSAMIENTO || 'low';
}

module.exports = { obtenerCliente, nombreModelo, nivelPensamiento };