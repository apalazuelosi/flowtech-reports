// Atomic counter: POST {key} → { value } (next integer for that key).
// Used for unique HYDAC bottle # and per-day sample numbers.

const { sb, json, endpoint } = require('./lib/supabase');

exports.handler = endpoint(async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });
  const { key } = JSON.parse(event.body || '{}');
  if (!key) return json(400, { error: 'Falta key' });
  // Calls the next_seq(seq_key) Postgres function via PostgREST RPC.
  const result = await sb('rpc/next_seq', { method: 'POST', body: { seq_key: key } });
  const value = Array.isArray(result) ? result[0] : result;
  return json(200, { value: Number(value) });
});
