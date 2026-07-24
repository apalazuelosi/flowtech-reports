// Scheduled keep-alive. A tiny query every few days registers activity so the
// free-tier Supabase project never sits idle long enough to auto-pause.
// Schedule is set in netlify.toml ([functions.keepalive] schedule = ...).

const { sb } = require('./lib/supabase');

exports.handler = async () => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return { statusCode: 200, body: 'skip: supabase not configured' };
  }
  try {
    await sb('clients?select=id&limit=1'); // lightest possible read
    return { statusCode: 200, body: 'ok' };
  } catch (err) {
    console.error('keepalive failed:', err.message);
    return { statusCode: 500, body: err.message };
  }
};
