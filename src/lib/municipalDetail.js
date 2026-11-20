import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

import { ADMIN_EMAIL, isAdmin } from './admin';

export const MUNICIPAL_ADMIN_EMAIL = ADMIN_EMAIL;

const COLLECTION = 'matches_cache_municipal';

export const isMunicipalAdmin = isAdmin;

// Los partidos no tienen id: se identifican por fecha, hora y equipos.
function sameMatch(a, b) {
  return a.fecha === b.fecha && a.hora === b.hora
    && a.homeTeam === b.homeTeam && a.awayTeam === b.awayTeam;
}

// `result` ({ homeScore, awayScore }) es opcional: marca el partido como finalizado a mano.
// El sync del ayuntamiento lo respeta hasta que publique su propio resultado, que prevalece.
export async function saveMatchDetail(season, round, match, detail, result = null) {
  const ref  = doc(db, COLLECTION, `${season}_${round}`);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('No existe la jornada en Firestore.');

  let found = false;
  const matches = (snap.data().matches ?? []).map(m => {
    if (!sameMatch(m, match)) return m;
    found = true;
    const sameResult = m.status === 'finished'
      && m.homeScore === result?.homeScore && m.awayScore === result?.awayScore;
    const patch = result && !sameResult
      ? { homeScore: result.homeScore, awayScore: result.awayScore, status: 'finished', manualResult: true }
      : {};
    return { ...m, ...patch, detail };
  });
  if (!found) throw new Error('No se encontró el partido en la jornada.');

  await setDoc(ref, { ...snap.data(), matches, detailUpdatedAt: serverTimestamp() });
}

export async function getRoster(season) {
  const snap = await getDoc(doc(db, COLLECTION, `roster_${season}`));
  return snap.exists() ? (snap.data().players ?? []) : [];
}

export async function saveRoster(season, players) {
  await setDoc(doc(db, COLLECTION, `roster_${season}`), {
    updatedAt: serverTimestamp(),
    players,
  });
}
