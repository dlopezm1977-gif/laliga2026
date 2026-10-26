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

const SEASON        = '2627';
const MATCHES_URL   = 'https://datos.madrid.es/api/3/action/datastore_search?resource_id=211549-0-juegos-deportivos-actual-csv&limit=500&q=30797';
const STANDINGS_URL = 'https://datos.madrid.es/api/3/action/datastore_search?resource_id=211549-2-juegos-deportivos-actual-csv&limit=100&q=30797';

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
  // Jornada del partido pendiente más próximo (un aplazado reprogramado a lejos no secuestra la jornada)
  let nextRound = null, nextDate = null;
  for (const rd of rounds) {
    for (const m of roundData[rd]) {
      if (m.status !== 'scheduled' || !m.fecha || m.fecha < today) continue;
      if (nextDate === null || m.fecha < nextDate) { nextDate = m.fecha; nextRound = rd; }
    }
  }
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
    // Conserva el detalle manual (alineación/incidencias) que no viene de la API
    const ref = db.collection('matches_cache_municipal').doc(`${SEASON}_${rd}`);
    const existing = await ref.get();
    if (existing.exists) {
      const key = m => `${m.fecha}|${m.hora}|${m.homeTeam}|${m.awayTeam}`;
      const details = new Map((existing.data().matches ?? []).filter(m => m.detail).map(m => [key(m), m.detail]));
      for (const m of matches) {
        const d = details.get(key(m));
        if (d) m.detail = d;
      }
    }
    batch.set(db.collection('matches_cache_municipal').doc(`${SEASON}_${rd}`), {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      matches,
    });
    ops++;
    if (ops >= BATCH_SIZE) await flush();
  }

  const existingMeta = await db.collection('matches_cache_municipal').doc('meta').get();
  const existingSeasons = existingMeta.exists ? (existingMeta.data().seasons ?? []) : [];
  const seasons = [...new Set([...existingSeasons, SEASON])].sort();

  batch.set(db.collection('matches_cache_municipal').doc('meta'), {
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    currentSeason: SEASON,
    seasons,
    currentRound,
    totalRounds,
  });
  ops++;
  await flush();

  console.log(`Partidos sync: ${Object.keys(all).length} jornadas, jornada actual = ${currentRound}`);
  return all;
}

async function syncStandings(matchData = {}) {
  console.log('\nFetching clasificación de la Liga Municipal…');
  const res     = await fetch(STANDINGS_URL);
  const json    = await res.json();
  const records = json.result?.records ?? [];

  let standings;
  if (records.length > 0) {
    standings = records
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
  } else {
    // La API aún no tiene datos: clasificación provisional con equipos en orden alfabético, todo a 0
    const teams = new Set();
    for (const matches of Object.values(matchData)) {
      for (const m of matches) {
        if (m.homeTeam && m.homeTeam !== '** DESCANSA **') teams.add(m.homeTeam);
        if (m.awayTeam && m.awayTeam !== '** DESCANSA **') teams.add(m.awayTeam);
      }
    }
    standings = [...teams].sort((a, b) => a.localeCompare(b, 'es')).map((name, i) => ({
      position: i + 1, name, pts: 0, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, gd: 0,
    }));
  }

  await db.collection('standings_cache_municipal').doc(SEASON).set({
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    standings,
  });
  console.log(`Clasificación: ${standings.length} equipos${records.length === 0 ? ' (provisional, ordenada alfabéticamente)' : ''}`);
}

async function main() {
  const matchData = await syncMatches();
  await syncStandings(matchData);
  console.log('\nSync Liga Municipal completado.');
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
