// CRUD for clients.
//   GET    /clients            → list all (ordered by name)
//   POST   /clients   {client} → insert (no id) or update (with id); returns the row
//   DELETE /clients?id=UUID    → delete

const { sb, json, endpoint } = require('./lib/supabase');

const ALLOWED = ['id', 'name', 'iso', 'water', 'logo', 'default_generated_by', 'notes'];

function pick(obj) {
  const out = {};
  for (const k of ALLOWED) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

exports.handler = endpoint(async (event) => {
  if (event.httpMethod === 'GET') {
    const rows = await sb('clients?select=*&order=name.asc');
    return json(200, rows);
  }

  if (event.httpMethod === 'POST') {
    const incoming = pick(JSON.parse(event.body || '{}'));
    if (!incoming.name) return json(400, { error: 'El cliente necesita un nombre.' });
    incoming.updated_at = new Date().toISOString();
    // Upsert on primary key: with an id it merges, without one it inserts.
    const rows = await sb('clients', {
      method: 'POST',
      body: [incoming],
      prefer: 'resolution=merge-duplicates,return=representation',
    });
    return json(200, rows[0]);
  }

  if (event.httpMethod === 'DELETE') {
    const id = event.queryStringParameters?.id;
    if (!id) return json(400, { error: 'Falta id.' });
    await sb(`clients?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
    return json(200, { ok: true });
  }

  return json(405, { error: 'Method Not Allowed' });
});
