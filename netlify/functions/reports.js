// CRUD for saved reports.
//   GET    /reports            → list (lightweight: no samples/profile, for the history table)
//   GET    /reports?id=UUID    → one full report (with samples + profile, to re-render)
//   POST   /reports   {report} → save a new report; returns the row
//   DELETE /reports?id=UUID    → delete

const { sb, json, endpoint } = require('./lib/supabase');

const LIST_COLS = 'id,client_name,generated_by,overall_status,sample_count,created_at';
const ALLOWED = ['client_id', 'client_name', 'generated_by', 'overall_status', 'sample_count', 'samples', 'profile'];

function pick(obj) {
  const out = {};
  for (const k of ALLOWED) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

exports.handler = endpoint(async (event) => {
  const id = event.queryStringParameters?.id;

  if (event.httpMethod === 'GET') {
    if (id) {
      const rows = await sb(`reports?id=eq.${encodeURIComponent(id)}&select=*`);
      return json(200, rows[0] || null);
    }
    const rows = await sb(`reports?select=${LIST_COLS}&order=created_at.desc`);
    return json(200, rows);
  }

  if (event.httpMethod === 'POST') {
    const incoming = pick(JSON.parse(event.body || '{}'));
    if (!incoming.samples) return json(400, { error: 'El reporte no tiene muestras.' });
    const rows = await sb('reports', {
      method: 'POST',
      body: [incoming],
      prefer: 'return=representation',
    });
    return json(200, rows[0]);
  }

  if (event.httpMethod === 'DELETE') {
    if (!id) return json(400, { error: 'Falta id.' });
    await sb(`reports?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
    return json(200, { ok: true });
  }

  return json(405, { error: 'Method Not Allowed' });
});
