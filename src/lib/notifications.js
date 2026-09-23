import { getMessaging, getToken, deleteToken, onMessage } from 'firebase/messaging';
import { doc, setDoc, deleteDoc, collection, getDocs, updateDoc, serverTimestamp } from 'firebase/firestore';
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
  return { id, label, enabled: true };
}

export async function removeDeviceToken(uid, id) {
  try { await deleteToken(messaging()); } catch {}
  await deleteDoc(doc(db, 'users', uid, 'fcmTokens', id));
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
