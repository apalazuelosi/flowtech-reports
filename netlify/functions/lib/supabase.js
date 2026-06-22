// Tiny PostgREST client for the Netlify functions. Talks to Supabase's REST API
// with the service_role key (server-side only — never shipped to the browser).
// No npm dependency: uses the global fetch available in Netlify's Node runtime.

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;

function configured() {
  return Boolean(URL && KEY);
}

// path is a PostgREST path+query, e.g. "clients?select=*&order=name".
async function sb(path, { method = 'GET', body, prefer } = {}) {
  const headers = {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    'Content-Type': 'application/json',
  };
  if (prefer) headers.Prefer = prefer;

  const res = await fetch(`${URL}/rest/v1/${path}`, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
};

function json(statusCode, data) {
  return { statusCode, headers: { 'Content-Type': 'application/json', ...CORS }, body: JSON.stringify(data) };
}

// Wraps a handler with CORS preflight + a configured() guard + error catching.
function endpoint(handler) {
  return async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
    if (!configured()) return json(500, { error: 'Supabase no está configurado en el servidor (faltan SUPABASE_URL / SUPABASE_SERVICE_KEY).' });
    try {
      return await handler(event);
    } catch (err) {
      return json(500, { error: err.message });
    }
  };
}

module.exports = { sb, configured, json, endpoint, CORS };
