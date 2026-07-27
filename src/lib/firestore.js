import {
  doc, getDoc, setDoc, updateDoc, collection, getDocs,
  query, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

// ── predictions ────────────────────────────────────────────────────────────

export async function getPrediction(uid, matchday) {
  const snap = await getDoc(
    doc(db, 'predictions', uid, 'matchdays', String(matchday))
  );
  return snap.exists() ? snap.data() : null;
}

export async function savePrediction(uid, matchday, matches, favoriteTeam) {
  await setDoc(
    doc(db, 'predictions', uid, 'matchdays', String(matchday)),
    { matches, favoriteTeam: favoriteTeam || null, savedAt: serverTimestamp() }
  );
}

export async function getSeasonPrediction(uid) {
  const snap = await getDoc(doc(db, 'season_predictions', uid));
  return snap.exists() ? snap.data() : null;
}

export async function saveSeasonPrediction(uid, data) {
  await setDoc(doc(db, 'season_predictions', uid), {
    ...data,
    savedAt: serverTimestamp(),
  });
}

export async function getAllPredictions(uid) {
  const snap = await getDocs(collection(db, 'predictions', uid, 'matchdays'));
  const result = {};
  snap.forEach(d => { result[d.id] = d.data(); });
  return result;
}

export async function getAllMatchdayPredictions(matchday) {
  const usersSnap = await getDocs(collection(db, 'users'));
  const users = [];
  usersSnap.forEach(d => users.push({ uid: d.id, username: d.data().username || 'Usuario' }));

  const results = await Promise.all(
    users.map(async ({ uid, username }) => {
      try {
        const snap = await getDoc(doc(db, 'predictions', uid, 'matchdays', String(matchday)));
        if (!snap.exists()) return null;
        const data = snap.data();
        return { uid, username, matches: data.matches || [], favoriteTeam: data.favoriteTeam || null };
      } catch {
        return null;
      }
    })
  );
  return results.filter(Boolean);
}

// ── monthly predictions ────────────────────────────────────────────────────

export async function getMonthlyPrediction(uid, monthKey) {
  const snap = await getDoc(doc(db, 'monthly_predictions', uid, 'months', monthKey));
  return snap.exists() ? snap.data() : null;
}

export async function saveMonthlyPrediction(uid, monthKey, data) {
  await setDoc(
    doc(db, 'monthly_predictions', uid, 'months', monthKey),
    { ...data, savedAt: serverTimestamp() }
  );
}

export async function getAllMonthlyPredictionsForUser(uid) {
  const snap = await getDocs(collection(db, 'monthly_predictions', uid, 'months'));
  const result = {};
  snap.forEach(d => { result[d.id] = d.data(); });
  return result;
}

export async function getAllMonthlyResults() {
  const snap = await getDocs(collection(db, 'monthly_results'));
  const result = {};
  snap.forEach(d => { result[d.id] = d.data(); });
  return result;
}

export async function getAllMonthPredictions(monthKey) {
  const usersSnap = await getDocs(collection(db, 'users'));
  const users = [];
  usersSnap.forEach(d => users.push({ uid: d.id, username: d.data().username || 'Usuario' }));
  const results = await Promise.all(
    users.map(async ({ uid, username }) => {
      try {
        const snap = await getDoc(doc(db, 'monthly_predictions', uid, 'months', monthKey));
        if (!snap.exists()) return null;
        return { uid, username, ...snap.data() };
      } catch { return null; }
    })
  );
  return results.filter(Boolean);
}

// ── scores ─────────────────────────────────────────────────────────────────

export async function getAllScores() {
  const [scoresSnap, usersSnap] = await Promise.all([
    getDocs(query(collection(db, 'scores'), orderBy('totalPoints', 'desc'))),
    getDocs(collection(db, 'users')),
  ]);
  const userMap = {};
  usersSnap.forEach(d => { userMap[d.id] = d.data(); });
  const result = [];
  scoresSnap.forEach(d => {
    result.push({ uid: d.id, ...d.data(), username: userMap[d.id]?.username || 'Usuario' });
  });
  return result;
}

export async function getUserScore(uid) {
  const snap = await getDoc(doc(db, 'scores', uid));
  return snap.exists() ? snap.data() : null;
}

// ── users ──────────────────────────────────────────────────────────────────

export async function getUser(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
}

export async function createUser(uid, data) {
  await setDoc(doc(db, 'users', uid), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

export async function updateUser(uid, data) {
  await updateDoc(doc(db, 'users', uid), data);
}
