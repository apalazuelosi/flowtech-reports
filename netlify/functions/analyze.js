exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { pdfBase64 } = JSON.parse(event.body);

    const prompt = `Eres un experto en análisis de aceite hidráulico y lubricación industrial. Extrae datos de reportes Bureau Veritas / LOAMS.
El PDF puede contener UNA o MÚLTIPLES muestras (una por página).
Extrae TODAS las muestras que encuentres.
Responde ÚNICAMENTE con un array JSON válido, sin markdown ni explicación.
Cada elemento del array debe tener estos campos (usa null si no se encuentra):

[{
  "status": "CRITICAL" o "WARNING" o "NORMAL" o "CAUTION",
  "labNo": "string",
  "sampledDate": "string",
  "receivedDate": "string",
  "completedDate": "string",
  "unitId": "string",
  "componentDescription": "string",
  "worksite": "string",
  "referenceNo": "string",
  "fluidManufacturer": "string",
  "fluidProduct": "string",
  "fluidGrade": "string",
  "evaluatedBy": "string",
  "isoCode": "string",
  "waterKFppm": number o null,
  "waterCritical": true o false,
  "particles4um": number o null,
  "particles6um": number o null,
  "particles14um": number o null,
  "particles21um": number o null,
  "particles38um": number o null,
  "particles70um": number o null,
  "recommendation": "string" o null
}]

Para el campo "recommendation", redacta una nota técnica profesional en español que integre TODOS los hallazgos relevantes de la muestra:
- Si hay contaminación por partículas elevada (según el código ISO), menciónala con contexto técnico.
- Para agua: usa estos umbrales → < 250 ppm = normal (no mencionar), 250–499 ppm = precaución (mencionar y recomendar monitoreo), ≥ 500 ppm = crítico (mencionar urgentemente y recomendar acción inmediata como drenado, filtración o cambio de fluido).
- Si ambos problemas están presentes, redacta una nota unificada y coherente que aborde los dos.
- Si todo está dentro de parámetros normales, escribe una nota breve confirmando que el fluido está en condiciones aceptables.
- Tono: técnico, directo, profesional. Máximo 3 oraciones.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    const data = await response.json();
    const raw = data.content.map(c => c.text || '').join('').trim();
    const clean = raw.replace(/```json|```/g, '').trim();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: clean
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
