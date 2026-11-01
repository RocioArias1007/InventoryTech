// Mide cuánto tarda UNA llamada simple a Gemini.
// Uso: node src/scripts/medirGemini.js            (usa GEMINI_MODEL del .env)
//      node src/scripts/medirGemini.js NOMBRE_DEL_MODELO

require('dotenv').config();

async function main() {
  const modelo = process.argv[2] || process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  const { GoogleGenAI } = await import('@google/genai');

  // Si Google no responde en 30 segundos, cortamos y mostramos el error.
  const cliente = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: { timeout: 30000 }
  });

  console.log(`Modelo: ${modelo}`);
  const inicio = Date.now();
  try {
    const r = await cliente.interactions.create({
      model: modelo,
      input: 'Responde solo con la palabra: listo',
      generation_config: { thinking_level: 'low' }
    });
    console.log('Respuesta:', r.output_text);
  } catch (error) {
    console.log('Error:', error.status || '', error.message);
  }
  console.log(`Tardó ${((Date.now() - inicio) / 1000).toFixed(1)} segundos`);
}

main();