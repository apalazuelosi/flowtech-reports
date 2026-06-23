// Thin client for the Netlify functions that proxy Supabase. Everything goes
// through the server so no database keys live in the browser.

const BASE = '/.netlify/functions';

async function req(path, { method = 'GET', body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

// Clients
export const getClients = () => req('/clients');
export const saveClient = (client) => req('/clients', { method: 'POST', body: client });
export const deleteClient = (id) => req(`/clients?id=${encodeURIComponent(id)}`, { method: 'DELETE' });

// Counters (for HYDAC export numbering)
export const nextSeq = (key) => req('/seq', { method: 'POST', body: { key } }).then(r => r.value);

// Reports
export const getReports = () => req('/reports');
export const getReport = (id) => req(`/reports?id=${encodeURIComponent(id)}`);
export const saveReport = (report) => req('/reports', { method: 'POST', body: report });
export const updateReport = (id, fields) => req('/reports', { method: 'POST', body: { id, ...fields } });
export const deleteReport = (id) => req(`/reports?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
