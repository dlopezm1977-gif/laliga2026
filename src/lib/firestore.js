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

export async function savePrediction(uid, matchday, matches) {
  await setDoc(
    doc(db, 'predictions', uid, 'matchdays', String(matchday)),
    { matches, savedAt: serverTimestamp() }
  );
}

export async function getAllPredictions(uid) {
  const snap = await getDocs(collection(db, 'predictions', uid, 'matchdays'));
  const result = {};
  snap.forEach(d => { result[d.id] = d.data(); });
  return result;
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
