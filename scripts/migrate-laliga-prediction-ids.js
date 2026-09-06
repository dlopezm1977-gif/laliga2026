// migrate-laliga-prediction-ids.js
// Migración única: reemplaza los matchId de football-data.org por matchId de bzzoiro
// en todos los documentos de predicciones de LaLiga guardados en Firestore.
//
// Uso:
//   FD_TOKEN=xxx BZZOIRO_TOKEN=yyy FIREBASE_SERVICE_ACCOUNT='{...}' node migrate-laliga-prediction-ids.js
// O con .env en scripts/:
//   node migrate-laliga-prediction-ids.js

const fs    = require('fs');
const path  = require('path');
const admin = require('firebase-admin');

// ── carga .env si existe ──────────────────────────────────────────────────────
if (!process.env.FOOTBALL_DATA_TOKEN) {
  try {
    const envPath = path.join(__dirname, '.env');
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
      const [k, ...rest] = line.split('=');
      if (k && rest.length) process.env[k.trim()] = rest.join('=').trim();
    });
  } catch {}
}

const FD_TOKEN = process.env.FOOTBALL_DATA_TOKEN;
if (!FD_TOKEN) { console.error('Falta FOOTBALL_DATA_TOKEN'); process.exit(1); }

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const FD_BASE = 'https://api.football-data.org/v4';
const FD_HDR  = { 'X-Auth-Token': FD_TOKEN };

const SHORT_NAMES = {
  // FD short names (shortName field)
  'Barça':                    'Barcelona',
  'Atleti':                   'Atlético',
  'Santander':                'Racing',
  'Betis':                    'Betis',
  'Sociedad':                 'Real Sociedad',
  'Athletic':                 'Athletic',
  'Osasuna':                  'Osasuna',
  'Villarreal':               'Villarreal',
  'Getafe':                   'Getafe',
  'Celta':                    'Celta',
  'Rayo':                     'Rayo',
  'Alavés':                   'Alavés',
  'Espanyol':                 'Espanyol',
  'Sevilla':                  'Sevilla',
  'Valencia':                 'Valencia',
  'Levante':                  'Levante',
  'Elche':                    'Elche',
  'Málaga':                   'Málaga',
  'Deportivo':                'Deportivo',
  // FD full names (name field)
  'Real Madrid':              'Real Madrid',
  'FC Barcelona':             'Barcelona',
  'Barcelona':                'Barcelona',
  'Atlético de Madrid':       'Atlético',
  'Atletico de Madrid':       'Atlético',
  'Atlético Madrid':          'Atlético',
  'Club Atletico de Madrid':  'Atlético',
  'Club Atlético de Madrid':  'Atlético',
  'Sevilla FC':               'Sevilla',
  'Real Betis Balompié':      'Betis',
  'Real Betis':               'Betis',
  'Real Sociedad':            'Real Sociedad',
  'Villarreal CF':            'Villarreal',
  'Athletic Club':            'Athletic',
  'Valencia CF':              'Valencia',
  'CA Osasuna':               'Osasuna',
  'Celta de Vigo':            'Celta',
  'Celta Vigo':               'Celta',
  'RC Celta':                 'Celta',
  'Getafe CF':                'Getafe',
  'Rayo Vallecano':           'Rayo',
  'Deportivo Alavés':         'Alavés',
  'Deportivo Alaves':         'Alavés',
  'RCD Espanyol':             'Espanyol',
  'Racing Santander':         'Racing',
  'Real Racing Club':         'Racing',
  'Levante UD':               'Levante',
  'Deportivo de La Coruña':   'Deportivo',
  'Deportivo de La Coruna':   'Deportivo',
  'RC Deportivo':             'Deportivo',
  'Elche CF':                 'Elche',
  'Málaga CF':                'Málaga',
  'Malaga CF':                'Málaga',
  'Malaga':                   'Málaga',
};
const short = name => SHORT_NAMES[name] || name;

async function fetchJson(url, headers) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res.json();
}

// ── 1. Obtener matchIds bzzoiro desde Firestore (matches_cache) ───────────────
async function fetchBzzoiroFromFirestore() {
  // matches_cache tiene matchId=bzzoiro, homeTeam, awayTeam por jornada
  const snap = await db.collection('matches_cache').get();
  const events = [];
  snap.forEach(doc => {
    const rd = Number(doc.id);
    for (const m of (doc.data().matches || [])) {
      if (m.matchId && m.homeTeam && m.awayTeam) {
        events.push({ id: m.matchId, home_team: m.homeTeam, away_team: m.awayTeam, round_number: rd });
      }
    }
  });
  return events;
}

// ── 2. Obtener todos los partidos FD ──────────────────────────────────────────
async function fetchFDMatches() {
  const all = [];
  for (const season of ['2025', '2026']) {
    try {
      const data = await fetchJson(
        `${FD_BASE}/competitions/PD/matches?season=${season}`,
        FD_HDR
      );
      const matches = data.matches || [];
      all.push(...matches);
      console.log(`   FD season=${season}: ${matches.length} partidos`);
    } catch (e) {
      console.warn(`   FD season=${season}: ${e.message}`);
    }
  }
  return all;
}

// ── 3. Construir el mapa fd_id → bz_id ───────────────────────────────────────
function buildIdMap(bzEvents, fdMatches) {
  // Indexar bzzoiro por "round|homeTeam|awayTeam"
  const bzIndex = {};
  for (const e of bzEvents) {
    const key = `${e.round_number}|${short(e.home_team)}|${short(e.away_team)}`;
    bzIndex[key] = e.id;
  }

  // Indexar bzzoiro por "homeTeam|awayTeam" (sin ronda, por si difiere)
  const bzIndexNoRound = {};
  for (const e of bzEvents) {
    const key = `${short(e.home_team)}|${short(e.away_team)}`;
    if (!bzIndexNoRound[key]) bzIndexNoRound[key] = e.id;
  }

  const map = {}; // fd_id → bz_id
  let found = 0, notFound = 0;

  for (const m of fdMatches) {
    const ht = short(m.homeTeam?.shortName || m.homeTeam?.name || '');
    const at = short(m.awayTeam?.shortName || m.awayTeam?.name || '');
    const rd = m.matchday;
    const keyFull   = `${rd}|${ht}|${at}`;
    const keyNoRound = `${ht}|${at}`;

    const bzId = bzIndex[keyFull] ?? bzIndexNoRound[keyNoRound] ?? null;
    if (bzId) {
      map[String(m.id)] = String(bzId);
      found++;
    } else {
      console.warn(`  ⚠ No bzzoiro match for FD ${m.id} (J${rd}: ${ht} vs ${at})`);
      notFound++;
    }
  }

  console.log(`ID mapping: ${found} encontrados, ${notFound} sin correspondencia`);
  return map;
}

// ── 4. Migrar predicciones en Firestore ───────────────────────────────────────
async function migratePredictions(idMap) {
  const bzIds = new Set(Object.values(idMap));

  // Obtener todos los usuarios
  const usersSnap = await db.collection('users').get();
  const users = [];
  usersSnap.forEach(d => users.push(d.id));
  console.log(`Procesando ${users.length} usuarios…`);

  let totalDocs = 0, updatedDocs = 0;

  for (const uid of users) {
    const jornadasSnap = await db.collection('predictions').doc(uid).collection('matchdays').get();
    for (const doc of jornadasSnap.docs) {
      totalDocs++;
      const data = doc.data();
      if (!data.matches) continue;

      let changed = false;
      const newMatches = data.matches.map(m => {
        const fd = String(m.matchId);
        if (bzIds.has(fd)) return m; // ya es bzzoiro
        const bz = idMap[fd];
        if (bz) {
          changed = true;
          return { ...m, matchId: Number(bz) };
        }
        // matchId desconocido — lo dejamos tal cual (no podemos mapearlo)
        console.warn(`    ⚠ uid=${uid} j=${doc.id} matchId=${m.matchId} sin mapa, se mantiene`);
        return m;
      });

      if (changed) {
        await doc.ref.update({ matches: newMatches });
        updatedDocs++;
        console.log(`  ✓ uid=${uid} j=${doc.id} actualizado`);
      }
    }
  }

  console.log(`\nMigración completada: ${updatedDocs}/${totalDocs} documentos actualizados`);
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('1. Leyendo bzzoiro events desde Firestore (matches_cache)…');
  const bzEvents = await fetchBzzoiroFromFirestore();
  console.log(`   → ${bzEvents.length} eventos`);

  console.log('2. Fetching FD matches…');
  const fdMatches = await fetchFDMatches();
  console.log(`   → ${fdMatches.length} partidos`);

  console.log('3. Building ID map…');
  const idMap = buildIdMap(bzEvents, fdMatches);

  if (Object.keys(idMap).length === 0) {
    console.error('Error: mapa vacío, abortando.');
    process.exit(1);
  }

  console.log('4. Migrating predictions in Firestore…');
  await migratePredictions(idMap);
}
main().catch(err => { console.error(err); process.exit(1); });
