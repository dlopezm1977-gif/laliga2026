// Ambientaciones estacionales (Halloween, Navidad). La configuración vive en
// Firestore: app_config/seasons → { seasons: [{ id, enabled, start: 'MM-DD', end: 'MM-DD', forceActive? }] }
export const SEASON_EMOJI = { halloween: '🎃', navidad: '🎄' };

const CACHE_KEY = 'quiniela-seasons';

function mmdd(date) {
  return String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

// Rangos MM-DD inclusivos; si start > end cruza el cambio de año (p. ej. 12-01 → 01-07)
export function activeSeasonId(seasons, date = new Date()) {
  const today = mmdd(date);
  const hit = (seasons ?? []).find(s => {
    if (!s?.id) return false;
    if (s.forceActive) return true;
    if (!s.enabled || !s.start || !s.end) return false;
    return s.start <= s.end
      ? today >= s.start && today <= s.end
      : today >= s.start || today <= s.end;
  });
  return hit?.id ?? null;
}

export function readCachedSeasons() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)) ?? []; } catch { return []; }
}

export function cacheSeasons(seasons) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(seasons)); } catch { /* sin storage */ }
}
