// Sync LaLiga Hypermotion (Segunda División) from sports.bzzoiro.com → Firestore
// Local:  node sync-segunda.js   (lee BZZOIRO_TOKEN de .env)
// CI/CD:  BZZOIRO_TOKEN=xxx FIREBASE_SERVICE_ACCOUNT='{...}' node sync-segunda.js

const fs    = require('fs');
const path  = require('path');
const admin = require('firebase-admin');

// Cargar .env local si no hay variable de entorno ya definida
if (!process.env.BZZOIRO_TOKEN) {
  try {
    const envPath = path.join(__dirname, '.env');
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
      const [k, ...rest] = line.split('=');
      if (k && rest.length) process.env[k.trim()] = rest.join('=').trim();
    });
  } catch {}
}

const BZZOIRO_TOKEN = process.env.BZZOIRO_TOKEN;
if (!BZZOIRO_TOKEN) {
  console.error('Missing BZZOIRO_TOKEN (añádelo en scripts/.env o como variable de entorno)');
  process.exit(1);
}

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const BASE_URL    = 'https://sports.bzzoiro.com/api/v2';
const LEAGUE_ID   = 38;
const SEASON_FROM = '2026-07-01'; // Inicio temporada 26/27

const HEADERS = { Authorization: `Token ${BZZOIRO_TOKEN}` };

async function fetchJson(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} — ${url}\n${txt}`);
  }
  return res.json();
}

async function fetchAllEvents() {
  console.log('Fetching all Segunda events (paginated)…');
  const events = [];
  let url = `${BASE_URL}/events/?league_id=${LEAGUE_ID}&date_from=${SEASON_FROM}&limit=50`;

  while (url) {
    const data = await fetchJson(url);
    events.push(...data.results);
    url = data.next || null;
    if (url) console.log(`  Fetched ${events.length}/${data.count}…`);
  }

  console.log(`Got ${events.length} events from API`);
  return events;
}

function normalizeEvent(e) {
  return {
    matchId:      e.id,
    homeTeam:     e.home_team,
    awayTeam:     e.away_team,
    homeScore:    e.home_score,
    awayScore:    e.away_score,
    homeScoreHT:  e.home_score_ht,
    awayScoreHT:  e.away_score_ht,
    status:       e.status,       // 'finished' | 'notstarted' | 'live' | etc.
    utcDate:      e.event_date,
    period:       e.period || '',
    currentMinute: e.current_minute,
  };
}

async function syncEvents() {
  const events = await fetchAllEvents();

  // Agrupar por jornada (round_number)
  const byRound = {};
  for (const e of events) {
    const rd = e.round_number;
    if (!rd) continue;
    if (!byRound[rd]) byRound[rd] = [];
    byRound[rd].push(normalizeEvent(e));
  }

  // Cargar caché existente
  const existingSnap = await db.collection('matches_cache_segunda').get();
  const existing = {};
  existingSnap.forEach(d => { existing[d.id] = d.data(); });

  let updated = 0;
  const batch = db.batch();

  for (const [rd, rdMatches] of Object.entries(byRound)) {
    const prev = existing[rd];

    // Merge: nunca sobreescribir resultado con null (protección ante glitches de API)
    let merged = rdMatches;
    if (prev?.matches) {
      const prevById = Object.fromEntries(prev.matches.map(m => [m.matchId, m]));
      merged = rdMatches.map(m => {
        const old = prevById[m.matchId];
        const apiLostScore = old && old.homeScore != null && m.homeScore == null;
        if (apiLostScore) {
          console.warn(`  ⚠ Rnd${rd} match ${m.matchId} (${m.homeTeam}-${m.awayTeam}): API sin goles, manteniendo anterior (${old.homeScore}-${old.awayScore})`);
          return old;
        }
        return m;
      });
    }

    const changed = !prev || JSON.stringify(prev.matches) !== JSON.stringify(merged);
    if (changed) {
      batch.set(db.collection('matches_cache_segunda').doc(String(rd)), {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        matches: merged,
      });
      updated++;
    }
  }

  if (updated > 0) {
    await batch.commit();
    console.log(`Updated ${updated} jornadas in Firestore (matches_cache_segunda)`);
  } else {
    console.log('No changes in events — Firestore not updated');
  }
}

async function syncStandings() {
  console.log('Fetching standings…');
  const data = await fetchJson(`${BASE_URL}/leagues/${LEAGUE_ID}/standings/`);

  await db.collection('standings_cache_segunda').doc('current').set({
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    standings: data.standings,
    zones:     data.zones,
    season:    data.season,
  });

  console.log(`Standings updated: ${data.standings?.length ?? 0} equipos`);
}

async function syncScorers() {
  console.log('Fetching scorers…');
  const scorersData = await fetchJson(`${BASE_URL}/leagues/${LEAGUE_ID}/top/scorers/?limit=30`);
  const scorers = scorersData.leaders ?? [];

  // Un fetch de asistencias por cada equipo distinto presente en el top de goleadores
  const teamIds = [...new Set(scorers.map(s => s.team_id).filter(Boolean))];
  console.log(`Fetching assists for ${teamIds.length} teams in parallel…`);
  const assistResponses = await Promise.all(
    teamIds.map(tid => fetchJson(`${BASE_URL}/leagues/${LEAGUE_ID}/top/assists/?team_id=${tid}`))
  );

  const assistsByPlayer = {};
  for (const res of assistResponses) {
    for (const a of (res.leaders ?? [])) {
      assistsByPlayer[a.player_id] = a.value;
    }
  }

  const leaders = scorers.map(s => ({
    rank:        s.rank,
    player_id:   s.player_id,
    player_name: s.player_name,
    position:    s.position,
    team_id:     s.team_id,
    team_name:   s.team_name,
    goals:       s.value,
    assists:     assistsByPlayer[s.player_id] ?? 0,
    matches:     s.matches,
  }));

  await db.collection('scorers_cache_segunda').doc('current').set({
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    leaders,
  });

  console.log(`Scorers updated: ${leaders.length} jugadores`);
}

syncEvents()
  .then(() => syncStandings())
  .then(() => syncScorers())
  .catch(err => { console.error(err); process.exit(1); });
