import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { db } from './firebase';

/* ── Vídeos (highlights de LaLiga y Segunda) ───────────────── */

export const LEAGUES = {
  laliga:  { label: 'LaLiga',  matches: 'matches_cache',         detail: 'match_detail_cache_laliga'  },
  segunda: { label: 'Segunda', matches: 'matches_cache_segunda', detail: 'match_detail_cache_segunda' },
};

// Todos los partidos de la liga (un documento por jornada), del más reciente al más antiguo
export async function loadMatches(leagueId) {
  const snap = await getDocs(collection(db, LEAGUES[leagueId].matches));
  const out = [];
  snap.forEach(d => {
    if (!/^\d+$/.test(d.id)) return;
    for (const m of d.data().matches ?? []) out.push({ ...m, round: Number(d.id) });
  });
  return out.sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate));
}

export function youtubeId(url) {
  const m = String(url ?? '').match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/);
  return m ? m[1] : null;
}

// Miniatura estándar de YouTube a partir de la URL del vídeo ('' si no es un enlace de YouTube)
export function thumbnailFromUrl(url) {
  const id = youtubeId(url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '';
}

export async function getHighlights(leagueId, matchId) {
  const snap = await getDoc(doc(db, LEAGUES[leagueId].detail, String(matchId)));
  return snap.exists() ? (snap.data().detail?.highlights ?? []) : [];
}

// merge: solo toca detail.highlights y conserva el resto del detalle. Mientras haya highlights guardados,
// los sync de LaLiga/Segunda no los vuelven a pedir a la API, así que la corrección se mantiene.
export async function saveHighlights(leagueId, matchId, highlights) {
  await setDoc(doc(db, LEAGUES[leagueId].detail, String(matchId)), { detail: { highlights } }, { merge: true });
}

/* ── Premios ───────────────────────────────────────────────── */

export async function getMonthlyResult(monthKey) {
  const snap = await getDoc(doc(db, 'monthly_results', monthKey));
  return snap.exists() ? snap.data() : {};
}

export async function saveMonthlyResult(monthKey, data) {
  await setDoc(doc(db, 'monthly_results', monthKey), data, { merge: true });
}

export async function getSeasonResultsDoc() {
  const snap = await getDoc(doc(db, 'season_results', 'current'));
  return snap.exists() ? snap.data() : {};
}

export async function saveSeasonResultsDoc(data) {
  await setDoc(doc(db, 'season_results', 'current'), data);
}
