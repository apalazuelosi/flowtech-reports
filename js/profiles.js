// Company profiles: each holds the limits used to classify a sample's ISO
// cleanliness code and water content. A profile is the single source of truth
// for "what counts as acceptable / attention / critical" for that client.
//
// ISO limits are stored as three-component codes {p4, p6, p14}. A measured
// component at-or-above the warn code is at least WARNING; at-or-above the
// critical code is CRITICAL. The worst of the three components wins.
//
// Water limits are plain ppm thresholds.

import { load, save } from './storage.js';

const KEY = 'profiles';
const ACTIVE_KEY = 'activeProfileId';

// The default profile reproduces the app's original hard-coded thresholds, so
// existing behaviour is preserved until someone tunes a client profile.
export const DEFAULT_PROFILE = {
  id: 'default',
  name: 'Flowtech (estándar)',
  builtIn: true,
  iso: {
    warn: { p4: 18, p6: 16, p14: 13 },
    crit: { p4: 20, p6: 18, p14: 15 },
  },
  water: { warn: 250, crit: 500 },
};

function seed() {
  const seeded = [structuredClone(DEFAULT_PROFILE)];
  save(KEY, seeded);
  return seeded;
}

export function getProfiles() {
  const list = load(KEY, null);
  if (!list || !Array.isArray(list) || list.length === 0) return seed();
  // Always guarantee the built-in default exists.
  if (!list.some(p => p.id === 'default')) list.unshift(structuredClone(DEFAULT_PROFILE));
  return list;
}

export function getProfile(id) {
  return getProfiles().find(p => p.id === id) || getProfiles()[0];
}

export function getActiveProfile() {
  const id = load(ACTIVE_KEY, 'default');
  return getProfile(id);
}

export function setActiveProfile(id) {
  save(ACTIVE_KEY, id);
}

function genId(name) {
  const base = (name || 'perfil').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return base + '-' + getProfiles().length + '-' + (base.length || 1);
}

export function saveProfile(profile) {
  const list = getProfiles();
  if (!profile.id) profile.id = genId(profile.name);
  const idx = list.findIndex(p => p.id === profile.id);
  if (idx >= 0) list[idx] = profile;
  else list.push(profile);
  save(KEY, list);
  return profile;
}

export function deleteProfile(id) {
  if (id === 'default') return false; // never delete the built-in
  const list = getProfiles().filter(p => p.id !== id);
  save(KEY, list);
  if (load(ACTIVE_KEY, 'default') === id) setActiveProfile('default');
  return true;
}

// A fresh profile pre-filled with the default limits, ready to edit.
export function blankProfile() {
  const p = structuredClone(DEFAULT_PROFILE);
  p.id = '';
  p.name = '';
  p.builtIn = false;
  return p;
}
