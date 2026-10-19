import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

// Enlaces manuales (YouTube) a goles de un partido de juveniles, por codacta
const COLLECTION = 'match_videos_rffm';

export async function getRffmVideos(matchId) {
  const snap = await getDoc(doc(db, COLLECTION, String(matchId)));
  return snap.exists() ? (snap.data().videos ?? []) : [];
}

export async function saveRffmVideos(matchId, videos) {
  await setDoc(doc(db, COLLECTION, String(matchId)), {
    updatedAt: serverTimestamp(),
    videos,
  });
}
