// Sync Liga Municipal (JDM) → Firestore
// Local:  node scripts/sync-municipal.js   (lee .env de scripts/.env)
// CI/CD:  FIREBASE_SERVICE_ACCOUNT='{...}' node scripts/sync-municipal.js

const fs   = require('fs');
const path = require('path');
const admin = require('firebase-admin');

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    const envPath = path.join(__dirname, '.env');
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
      const [k, ...rest] = line.split('=');
      if (k && rest.length) process.env[k.trim()] = rest.join('=').trim();
    });
  } catch {}
}

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : require('./serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const MATCHES_URL   = 'https://datos.madrid.es/api/3/action/datastore_search?resource_id=300257-45-deportes-colectivos-historico&limit=500&q=27601';
const STANDINGS_URL = 'https://datos.madrid.es/api/3/action/datastore_search?resource_id=300257-43-deportes-colectivos-historico&limit=100&q=27601';

function normalizeMatch(r) {
  const finished = r.Estado === 'F';
  return {
    homeTeam:  r.Equipo_local,
    awayTeam:  r.Equipo_visitante,
    homeScore: finished ? Number(r.Resultado1) : null,
    awayScore: finished ? Number(r.Resultado2) : null,
    status:    finished ? 'finished' : 'scheduled',
    jornada:   Number(r.Jornada),
    fecha:     r.Fecha,
    hora:      r.Hora,
    campo:     r.Campo,
  };
}

function detectCurrentRound(roundData) {
  const rounds = Object.keys(roundData).map(Number).sort((a, b) => a - b);
  if (!rounds.length) return 1;
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  const todayRound = rounds.find(rd => roundData[rd].some(m => m.fecha === today));
  if (todayRound) return todayRound;
  const nextRound = rounds.find(rd => roundData[rd].some(m => m.status === 'scheduled' && m.fecha >= today));
  if (nextRound) return nextRound;
  return rounds[rounds.length - 1];
}

async function syncMatches() {
  console.log('\nFetching partidos de la Liga Municipal…');
  const res     = await fetch(MATCHES_URL);
  const json    = await res.json();
  const records = json.result?.records ?? [];

  const all = {};
  for (const r of records) {
    const jornada = Number(r.Jornada);
    if (!all[jornada]) all[jornada] = [];
    all[jornada].push(normalizeMatch(r));
  }

  const rounds      = Object.keys(all).map(Number);
  const totalRounds = rounds.length > 0 ? Math.max(...rounds) : 22;
  const currentRound = detectCurrentRound(all);

  const BATCH_SIZE = 400;
  let batch = db.batch();
  let ops   = 0;

  const flush = async () => {
    if (ops > 0) { await batch.commit(); batch = db.batch(); ops = 0; }
  };

  for (const [rd, matches] of Object.entries(all)) {
    batch.set(db.collection('matches_cache_municipal').doc(String(rd)), {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      matches,
    });
    ops++;
    if (ops >= BATCH_SIZE) await flush();
  }

  batch.set(db.collection('matches_cache_municipal').doc('meta'), {
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    currentRound,
    totalRounds,
  });
  ops++;
  await flush();

  console.log(`Partidos sync: ${Object.keys(all).length} jornadas, jornada actual = ${currentRound}`);
  return all;
}

async function syncStandings() {
  console.log('\nFetching clasificación de la Liga Municipal…');
  const res     = await fetch(STANDINGS_URL);
  const json    = await res.json();
  const records = json.result?.records ?? [];

  const standings = records
    .map(r => ({
      position: Number(r.Posicion),
      name:     r.Nombre_equipo,
      pts:      Number(r.Puntos),
      pj:       Number(r.Partidos_jugados),
      pg:       Number(r.Partidos_ganados),
      pe:       Number(r.Partidos_empatados),
      pp:       Number(r.Partidos_perdidos),
      gf:       Number(r.Goles_favor),
      gc:       Number(r.Goles_contra),
      gd:       Number(r.Goles_favor) - Number(r.Goles_contra),
    }))
    .sort((a, b) => a.position - b.position);

  await db.collection('standings_cache_municipal').doc('current').set({
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    standings,
  });
  console.log(`Clasificación: ${standings.length} equipos`);
}

async function main() {
  await syncMatches();
  await syncStandings();
  console.log('\nSync Liga Municipal completado.');
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
