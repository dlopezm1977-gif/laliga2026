// Envía una notificación push de prueba a todos los tokens activos de un usuario
// Uso: node send-test-notif.js --uid <firebase-uid>
//      node send-test-notif.js --uid <firebase-uid> --title "Gol!" --body "Real Madrid 1-0 Barcelona"

const fs    = require('fs');
const path  = require('path');
const admin = require('firebase-admin');

// ── Cargar .env ────────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...rest] = line.split('=');
    if (k && rest.length && !process.env[k.trim()])
      process.env[k.trim()] = rest.join('=').trim();
  });
}

// ── Argumentos ─────────────────────────────────────────────────────────────
function arg(name) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : null;
}
const uid   = arg('--uid');
const title = arg('--title') || 'LaLiga 26/27 🔔';
const body  = arg('--body')  || 'Notificación de prueba — ¡todo funciona!';
const url   = arg('--url')   || '/laliga2026/';

if (!uid) {
  console.error('❌  Uso: node send-test-notif.js --uid <firebase-uid>');
  process.exit(1);
}

// ── Firebase Admin ─────────────────────────────────────────────────────────
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const tokensSnap = await db.collection('users').doc(uid).collection('fcmTokens').get();
  if (tokensSnap.empty) {
    console.error('❌  No hay tokens registrados para ese UID.');
    process.exit(1);
  }

  const tokens = [];
  tokensSnap.forEach(d => {
    const t = d.data();
    if (t.enabled && t.token) tokens.push({ id: d.id, label: t.label, token: t.token });
  });

  if (!tokens.length) {
    console.log('⚠️  Hay tokens pero todos están desactivados.');
    process.exit(0);
  }

  console.log(`📲  Enviando a ${tokens.length} dispositivo(s):`);
  tokens.forEach(t => console.log(`    · ${t.label} (${t.id})`));
  console.log(`    Título: ${title}`);
  console.log(`    Cuerpo: ${body}`);

  const results = await Promise.all(tokens.map(async t => {
    try {
      await admin.messaging().send({
        token: t.token,
        webpush: {
          headers: { Urgency: 'high' },
          data: { title, body, url },
        },
      });
      return { label: t.label, ok: true };
    } catch (err) {
      return { label: t.label, ok: false, error: err.message };
    }
  }));

  results.forEach(r => {
    if (r.ok) console.log(`  ✅  ${r.label}`);
    else       console.log(`  ❌  ${r.label}: ${r.error}`);
  });
}

main().catch(err => { console.error('❌ ', err.message); process.exit(1); });
