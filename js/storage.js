// Thin storage abstraction. Today it's backed by localStorage; swapping the
// body of these four functions for Supabase/REST calls later won't touch the
// rest of the app. Keep it dumb: get/set JSON by key.

const PREFIX = 'flowtech:';

export function load(key, fallback = null) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.error('storage.save failed', err);
    return false;
  }
}

export function remove(key) {
  localStorage.removeItem(PREFIX + key);
}
