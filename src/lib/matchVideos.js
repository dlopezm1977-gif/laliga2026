import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

// Enlaces manuales (YouTube) a goles y ocasiones de un partido, para juveniles y Municipal.
// Un documento por partido: { videos: [{ tipo, label, url }] }
const COLLECTION = 'match_videos';

export const VIDEO_TYPES = [
  { id: 'gol',     label: '⚽ Gol',     title: '⚽ Goles' },
  { id: 'ocasion', label: '🎯 Ocasión', title: '🎯 Ocasiones' },
];

// Juvenil: el acta (codacta) identifica el partido
export const rffmVideoKey = matchId => (matchId ? `rffm_${matchId}` : null);

// Municipal: los partidos no tienen id; temporada + jornada + equipos no cambia si se reprograma
const slug = s => String(s ?? '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');
export const municipalVideoKey = (season, round, home, away) =>
  season != null && round != null && home && away
    ? `municipal_${season}_${round}_${slug(home)}_${slug(away)}`
    : null;

export async function getMatchVideos(key) {
  const snap = await getDoc(doc(db, COLLECTION, key));
  return snap.exists() ? (snap.data().videos ?? []) : [];
}

export async function saveMatchVideos(key, videos) {
  await setDoc(doc(db, COLLECTION, key), { updatedAt: serverTimestamp(), videos });
}
