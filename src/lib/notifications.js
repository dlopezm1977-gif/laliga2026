import { getMessaging, getToken, deleteToken, onMessage } from 'firebase/messaging';
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, updateDoc, serverTimestamp } from 'firebase/firestore';
import { app, db } from './firebase';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

let _messaging = null;
function messaging() {
  if (!_messaging) _messaging = getMessaging(app);
  return _messaging;
}

export function isNotifSupported() {
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

function getDeviceLabel() {
  const ua = navigator.userAgent;
  let browser = 'Navegador';
  let os = 'Dispositivo';
  if (ua.includes('Edg'))                                    browser = 'Edge';
  else if (ua.includes('Chrome') && !ua.includes('Mobile')) browser = 'Chrome';
  else if (ua.includes('Chrome'))                            browser = 'Chrome';
  else if (ua.includes('Firefox'))                           browser = 'Firefox';
  else if (ua.includes('Safari'))                            browser = 'Safari';
  if (ua.includes('Android'))                os = 'Android';
  else if (ua.includes('iPhone'))            os = 'iPhone';
  else if (ua.includes('iPad'))              os = 'iPad';
  else if (ua.includes('Windows'))           os = 'Windows';
  else if (ua.includes('Macintosh'))         os = 'Mac';
  else if (ua.includes('Linux'))             os = 'Linux';
  return `${browser} en ${os}`;
}

function tokenDocId(token) {
  return token.slice(-24);
}

// Id del token de ESTE dispositivo, para saber cuál renovar si rota
const storageKey = uid => `fcmTokenId:${uid}`;

export async function requestAndSaveToken(uid) {
  const swReg = await navigator.serviceWorker.ready;
  const token = await getToken(messaging(), { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
  if (!token) return null;
  const id    = tokenDocId(token);
  const label = getDeviceLabel();
  await setDoc(
    doc(db, 'users', uid, 'fcmTokens', id),
    { token, label, enabled: true, lastActive: serverTimestamp() },
    { merge: true }
  );
  localStorage.setItem(storageKey(uid), id);
  return { id, label, enabled: true };
}

// Al abrir la app: si este dispositivo ya activó notificaciones, guarda su token
// vigente (puede haber rotado) conservando el interruptor 'enabled' del anterior.
export async function refreshDeviceToken(uid) {
  if (!isNotifSupported() || Notification.permission !== 'granted') return;

  const swReg = await navigator.serviceWorker.ready;
  const token = await getToken(messaging(), { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
  if (!token) return;

  const newId  = tokenDocId(token);
  const newRef = doc(db, 'users', uid, 'fcmTokens', newId);
  const newSnap = await getDoc(newRef);
  let storedId = localStorage.getItem(storageKey(uid));

  // Dispositivos que activaron antes de existir esta marca: se adopta el token
  // solo si ya está registrado; si no, no se vuelve a crear (pudo borrarse a propósito).
  if (!storedId && newSnap.exists()) storedId = newId;
  if (!storedId) return;

  let enabled = newSnap.exists() ? newSnap.data().enabled !== false : true;
  if (storedId !== newId) {
    const oldRef  = doc(db, 'users', uid, 'fcmTokens', storedId);
    const oldSnap = await getDoc(oldRef);
    if (oldSnap.exists()) {
      if (!newSnap.exists()) enabled = oldSnap.data().enabled !== false;
      await deleteDoc(oldRef);
    }
  }

  await setDoc(
    newRef,
    { token, label: getDeviceLabel(), enabled, lastActive: serverTimestamp() },
    { merge: true }
  );
  localStorage.setItem(storageKey(uid), newId);
}

export async function removeDeviceToken(uid, id) {
  try { await deleteToken(messaging()); } catch {}
  await deleteDoc(doc(db, 'users', uid, 'fcmTokens', id));
  if (localStorage.getItem(storageKey(uid)) === id) localStorage.removeItem(storageKey(uid));
}

export async function toggleDeviceEnabled(uid, id, enabled) {
  await updateDoc(doc(db, 'users', uid, 'fcmTokens', id), { enabled });
}

export async function getUserTokens(uid) {
  const snap = await getDocs(collection(db, 'users', uid, 'fcmTokens'));
  const tokens = [];
  snap.forEach(d => tokens.push({ id: d.id, ...d.data() }));
  return tokens.sort((a, b) => (b.lastActive?.toMillis?.() ?? 0) - (a.lastActive?.toMillis?.() ?? 0));
}

export function listenForegroundMessages(callback) {
  try {
    return onMessage(messaging(), payload => {
      const d = payload.data ?? {};
      callback({ title: d.title ?? 'LaLiga 26/27', body: d.body ?? '' });
    });
  } catch {
    return () => {};
  }
}
