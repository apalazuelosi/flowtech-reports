// Serverless extraction endpoint. Receives a base64 PDF (one batch of pages),
// asks Claude to extract every oil-analysis sample, and returns a JSON array.
//
// Uses structured outputs (output_config.format) so the model is constrained to
// the exact schema — no markdown-fence stripping, no malformed-JSON failures.

const MODEL = 'claude-opus-4-8';

// One sample's schema. Strict structured outputs requires every property listed
// in `required` and `additionalProperties: false`; nullable fields use a
// ["type","null"] union so the model can leave a field blank.
const SAMPLE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['CRITICAL', 'WARNING', 'NORMAL', 'CAUTION'] },
    labNo: { type: 'string' },
    sampledDate: { type: 'string' },
    receivedDate: { type: 'string' },
    completedDate: { type: 'string' },
    unitId: { type: 'string' },
    componentDescription: { type: 'string' },
    worksite: { type: 'string' },
    referenceNo: { type: 'string' },
    fluidManufacturer: { type: 'string' },
    fluidProduct: { type: 'string' },
    fluidGrade: { type: 'string' },
    evaluatedBy: { type: 'string' },
    isoCode: { type: 'string' },
    waterKFppm: { type: ['number', 'null'] },
    waterCritical: { type: ['boolean', 'null'] },
    particles4um: { type: ['number', 'null'] },
    particles6um: { type: ['number', 'null'] },
    particles14um: { type: ['number', 'null'] },
    particles21um: { type: ['number', 'null'] },
    particles38um: { type: ['number', 'null'] },
    particles70um: { type: ['number', 'null'] },
  },
  required: [
    'status', 'labNo', 'sampledDate', 'receivedDate', 'completedDate', 'unitId',
    'componentDescription', 'worksite', 'referenceNo', 'fluidManufacturer',
    'fluidProduct', 'fluidGrade', 'evaluatedBy', 'isoCode', 'waterKFppm',
    'waterCritical', 'particles4um', 'particles6um', 'particles14um',
    'particles21um', 'particles38um', 'particles70um',
  ],
};

const RESULT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    samples: { type: 'array', items: SAMPLE_SCHEMA },
  },
  required: ['samples'],
};

const PROMPT = `Eres un extractor de datos de reportes de análisis de aceite de Bureau Veritas / LOAMS.
El PDF puede contener UNA o MÚLTIPLES muestras (típicamente una por página).
Extrae TODAS las muestras que encuentres y devuélvelas en el campo "samples".
Para campos de texto que no encuentres usa cadena vacía "". Para valores numéricos
(agua, partículas) que no encuentres usa null.
waterCritical = true si el valor de agua está marcado con * o resaltado como crítico.
Para waterKFppm y los conteos de partículas, devuelve solo el número (sin unidades ni comas).`;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: 'Method Not Allowed' };
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Falta ANTHROPIC_API_KEY en el servidor.' }) };
  }

  try {
    const { pdfBase64 } = JSON.parse(event.body);
    if (!pdfBase64) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Falta pdfBase64.' }) };
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8192,
        // effort: low keeps latency under Netlify's 26s function timeout;
        // extraction is mechanical and doesn't benefit from deep thinking.
        output_config: {
          effort: 'low',
          format: { type: 'json_schema', schema: RESULT_SCHEMA },
        },
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
            { type: 'text', text: PROMPT },
          ],
        }],
      }),
    });

    const data = await response.json();

    if (!response.ok || data.type === 'error') {
      const msg = data.error?.message || `HTTP ${response.status}`;
      return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: `Claude API: ${msg}` }) };
    }
    if (data.stop_reason === 'refusal') {
      return { statusCode: 422, headers: CORS, body: JSON.stringify({ error: 'El modelo no pudo procesar este documento.' }) };
    }

    const text = (data.content || []).map(c => c.text || '').join('').trim();
    const parsed = JSON.parse(text); // guaranteed valid by structured outputs

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...CORS },
      body: JSON.stringify(parsed.samples || []),
    };
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
