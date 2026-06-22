// Clients = the merged "company profile" entity. Each client owns its
// contamination limits (iso/water — same shape the classifier reads) plus
// presentation/metadata (logo, default "generado por", notes).
//
// Data lives in Supabase via js/api.js. We cache the list in memory and keep
// only the *active* client id in localStorage (a pointer, not the data).

import { getClients as apiGetClients, saveClient as apiSave, deleteClient as apiDelete } from './api.js';
import { load, save } from './storage.js';

const ACTIVE_KEY = 'activeClientId';

export const DEFAULT_LIMITS = {
  iso: { warn: { p4: 18, p6: 16, p14: 13 }, crit: { p4: 20, p6: 18, p14: 15 } },
  water: { warn: 250, crit: 500 },
};

let cache = null;
let offline = false;

// Loads (and caches) the client list. Seeds a default client if the DB is empty.
// Falls back to a single in-memory default if the backend is unreachable, so the
// app stays usable.
export async function loadClients(force = false) {
  if (cache && !force) return cache;
  try {
    const rows = await apiGetClients();
    cache = rows.length
      ? rows
      : [await apiSave({ name: 'Flowtech (estándar)', iso: DEFAULT_LIMITS.iso, water: DEFAULT_LIMITS.water })];
    offline = false;
  } catch (err) {
    console.error('No se pudieron cargar los clientes:', err.message);
    offline = true;
    cache = [{
      id: '__local-default',
      name: 'Flowtech (estándar) — sin conexión',
      iso: DEFAULT_LIMITS.iso,
      water: DEFAULT_LIMITS.water,
      _offline: true,
    }];
  }
  return cache;
}

export const isOffline = () => offline;
export const getClientsCached = () => cache || [];
export const getClient = (id) => (cache || []).find(c => c.id === id) || (cache || [])[0] || null;

export const getActiveClientId = () => load(ACTIVE_KEY, null);
export const setActiveClient = (id) => save(ACTIVE_KEY, id);
export function getActiveClient() {
  return getClient(getActiveClientId());
}

export async function saveClient(client) {
  const row = await apiSave(client);
  await loadClients(true);
  return row;
}

export async function deleteClient(id) {
  await apiDelete(id);
  await loadClients(true);
}

export function blankClient() {
  return {
    name: '',
    iso: structuredClone(DEFAULT_LIMITS.iso),
    water: structuredClone(DEFAULT_LIMITS.water),
    logo: null,
    default_generated_by: '',
    notes: '',
  };
}
