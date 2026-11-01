// ============================================================
// probarGemini.js
// Prueba la conexión con Gemini. Se corre a mano, no hace parte del servidor.
// Uso: node src/scripts/probarGemini.js
// ============================================================

require('dotenv').config();

const MODELO = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

async function main() {
    const inicio = Date.now();

  if (!process.env.GEMINI_API_KEY) {
    console.error('Falta GEMINI_API_KEY en el archivo .env');
    process.exit(1);
  }

  // La librería se carga así para que funcione en un proyecto de tipo CommonJS.
  const { GoogleGenAI } = await import('@google/genai');
  const cliente = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // ---------- Prueba 1: una pregunta simple ----------
  console.log(`Modelo: ${MODELO}`);
  console.log('Prueba 1: pregunta simple...');
  const simple = await cliente.interactions.create({
  model: MODELO,
  input: 'Responde solo con la palabra: listo',
  generation_config: { thinking_level: 'low' }
});
  console.log('Respuesta:', simple.output_text);

  // ---------- Prueba 2: la IA pide un dato (function calling) ----------
  console.log('\nPrueba 2: la IA pide una consulta...');

  const herramienta = {
    type: 'function',
    name: 'consultar_existencias',
    description: 'Dice cuántas unidades quedan de un producto de la tienda.',
    parameters: {
      type: 'object',
      properties: {
        producto: { type: 'string', description: 'Nombre del producto, por ejemplo "arroz".' }
      },
      required: ['producto']
    }
  };

  const primera = await cliente.interactions.create({
    model: MODELO,
    input: '¿Cuántas unidades de arroz me quedan?',
    tools: [herramienta],
    generation_config: { thinking_level: 'low' },
  });

  const llamada = primera.steps.find((paso) => paso.type === 'function_call');
  if (!llamada) {
    console.log('La IA respondió sin pedir la consulta:', primera.output_text);
    return;
  }
  console.log('La IA pidió ejecutar:', llamada.name, JSON.stringify(llamada.arguments));

  // Aquí iría la consulta real a MySQL. Por ahora devolvemos un dato inventado.
  const resultado = { producto: 'Arroz Diana 1000g', unidades: 12 };

  const final = await cliente.interactions.create({
    model: MODELO,
    input: [
      {
        type: 'function_result',
        name: llamada.name,
        call_id: llamada.id,
        result: [{ type: 'text', text: JSON.stringify(resultado) }]
      }
    ],
    tools: [herramienta],
    previous_interaction_id: primera.id,
    generation_config: { thinking_level: 'low' },
  });

  console.log('Respuesta final de Katia:', final.output_text);

  console.log(`\nTiempo total: ${((Date.now() - inicio) / 1000).toFixed(1)} segundos`);
}

main().catch((error) => {
  console.error('Falló la prueba:', error.message);
  process.exit(1);
});