// Sync LaLiga (Primera División) from sports.bzzoiro.com → Firestore
// Local:  node sync-laliga.js   (lee BZZOIRO_TOKEN de .env)
// CI/CD:  BZZOIRO_TOKEN=xxx FIREBASE_SERVICE_ACCOUNT='{...}' node sync-laliga.js

const fs    = require('fs');
const path  = require('path');
const admin = require('firebase-admin');

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
const LEAGUE_ID   = 3;
const SEASON_FROM = '2026-07-01';
const HEADERS     = { Authorization: `Token ${BZZOIRO_TOKEN}` };
const SCORERS_TTL_MS = 60 * 60 * 1000;
const LIVE_STATUSES  = new Set(['live', 'in_progress', 'halftime', '1st_half', '2nd_half', 'extra_time', 'penalties']);

const SHORT_NAMES = {
  'Real Madrid':              'Real Madrid',
  'FC Barcelona':             'Barcelona',
  'Barcelona':                'Barcelona',
  'Atletico de Madrid':       'Atlético',
  'Atlético Madrid':          'Atlético',
  'Club Atletico de Madrid':  'Atlético',
  'Sevilla FC':               'Sevilla',
  'Sevilla':                  'Sevilla',
  'Real Betis':               'Betis',
  'Real Sociedad':            'Real Sociedad',
  'Villarreal CF':            'Villarreal',
  'Villarreal':               'Villarreal',
  'Athletic Club':            'Athletic',
  'Valencia CF':              'Valencia',
  'Valencia':                 'Valencia',
  'CA Osasuna':               'Osasuna',
  'Osasuna':                  'Osasuna',
  'Celta de Vigo':            'Celta',
  'Celta Vigo':               'Celta',
  'RC Celta':                 'Celta',
  'Getafe CF':                'Getafe',
  'Getafe':                   'Getafe',
  'Rayo Vallecano':           'Rayo',
  'Deportivo Alaves':         'Alavés',
  'Deportivo Alavés':         'Alavés',
  'Alaves':                   'Alavés',
  'RCD Espanyol':             'Espanyol',
  'Espanyol':                 'Espanyol',
  'Racing Santander':         'Racing',
  'Real Racing Club':         'Racing',
  'Levante UD':               'Levante',
  'Levante':                  'Levante',
  'Deportivo de La Coruna':   'Deportivo',
  'Deportivo de A Coruña':    'Deportivo',
  'RC Deportivo':             'Deportivo',
  'Elche CF':                 'Elche',
  'Elche':                    'Elche',
  'Malaga CF':                'Málaga',
  'Málaga CF':                'Málaga',
  'Malaga':                   'Málaga',
};
const short = name => SHORT_NAMES[name] || name;

const ABBR_MAP = {
  'Real Madrid': 'RMA', 'Barcelona': 'BAR', 'Atlético': 'ATM',
  'Sevilla': 'SEV', 'Betis': 'BET', 'Real Sociedad': 'RSO',
  'Villarreal': 'VIL', 'Athletic': 'ATH', 'Valencia': 'VAL',
  'Osasuna': 'OSA', 'Celta': 'CEL', 'Getafe': 'GET',
  'Rayo': 'RAY', 'Alavés': 'ALA', 'Espanyol': 'ESP',
  'Racing': 'RAC', 'Levante': 'LEV', 'Deportivo': 'DEP',
  'Elche': 'ELC', 'Málaga': 'MAL',
};

async function fetchJson(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} — ${url}\n${txt}`);
  }
  return res.json();
}

async function fetchAllEvents() {
  console.log('Fetching all LaLiga events (paginated)…');
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
    matchId:       e.id,
    homeTeam:      short(e.home_team),
    awayTeam:      short(e.away_team),
    homeScore:     e.home_score ?? null,
    awayScore:     e.away_score ?? null,
    homeScoreHT:   e.home_score_ht ?? null,
    awayScoreHT:   e.away_score_ht ?? null,
    status:        e.status,
    utcDate:       e.event_date,
    currentMinute: e.current_minute ?? null,
    period:        e.period ?? '',
  };
}

const EXCLUDED_STATUSES = new Set(['postponed', 'cancelled', 'abandoned']);

async function syncEvents(events) {
  const byRound = {};
  for (const e of events) {
    const rd = e.round_number;
    if (!rd) continue;
    if (EXCLUDED_STATUSES.has(e.status)) continue;
    if (!byRound[rd]) byRound[rd] = [];
    byRound[rd].push(normalizeEvent(e));
  }

  const existingSnap = await db.collection('matches_cache').get();
  const existing = {};
  existingSnap.forEach(d => { existing[d.id] = d.data(); });

  let updated = 0;
  const batch = db.batch();

  for (const [rd, rdMatches] of Object.entries(byRound)) {
    const prev = existing[rd];

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
      batch.set(db.collection('matches_cache').doc(String(rd)), {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        matches: merged,
      });
      updated++;
    }
  }

  if (updated > 0) {
    await batch.commit();
    console.log(`Updated ${updated} jornadas in Firestore (matches_cache)`);
  } else {
    console.log('No changes in events — Firestore not updated');
  }
}

async function syncScorers() {
  const cached = await db.collection('scorers_cache').doc('laliga').get();
  if (cached.exists) {
    const updatedAt = cached.data().updatedAt?.toDate?.();
    if (updatedAt && Date.now() - updatedAt.getTime() < SCORERS_TTL_MS) {
      console.log(`Scorers recientes (${Math.round((Date.now() - updatedAt.getTime()) / 60000)} min), saltando sync`);
      return;
    }
  }

  console.log('Fetching scorers…');
  const scorersData = await fetchJson(`${BASE_URL}/leagues/${LEAGUE_ID}/top/scorers/?limit=30`);
  const scorers = scorersData.leaders ?? [];

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

  const leaders = scorers.map(s => {
    const teamName = short(s.team_name);
    return {
      name:          s.player_name,
      team:          teamName,
      teamAbbr:      ABBR_MAP[teamName] ?? teamName.slice(0, 3).toUpperCase(),
      goals:         s.value,
      assists:       assistsByPlayer[s.player_id] ?? 0,
      playedMatches: s.matches,
    };
  });

  await db.collection('scorers_cache').doc('laliga').set({
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    scorers: leaders,
  });

  console.log(`Scorers updated: ${leaders.length} jugadores`);
}

async function syncMatchDetails(events, { backfill = false } = {}) {
  const now = new Date();
  const fmt = d => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(d);
  const todayStr     = fmt(now);
  const yesterdayStr = fmt(new Date(now.getTime() - 24 * 60 * 60 * 1000));

  const qualifying = events.filter(e => {
    if (LIVE_STATUSES.has(e.status)) return true;
    if (!e.event_date) return false;
    if (backfill && e.status === 'finished') return true;
    const matchDay = fmt(new Date(e.event_date));
    return matchDay === todayStr || matchDay === yesterdayStr;
  });

  if (!qualifying.length) {
    console.log('No hay partidos de hoy/ayer para sincronizar detalles (LaLiga)');
    return;
  }

  console.log(`Syncing details for ${qualifying.length} LaLiga matches…`);

  const cachedSnaps = await Promise.all(
    qualifying.map(e => db.collection('match_detail_cache_laliga').doc(String(e.id)).get())
  );
  const cachedByMatchId = Object.fromEntries(
    qualifying.map((e, i) => [e.id, cachedSnaps[i].exists ? cachedSnaps[i].data() : null])
  );

  for (const e of qualifying) {
    try {
      const cached        = cachedByMatchId[e.id];
      const matchFinished = e.status === 'finished';
      const matchStarted  = LIVE_STATUSES.has(e.status) || matchFinished;
      const hasHighlights = Array.isArray(cached?.detail?.highlights) && cached.detail.highlights.length > 0;
      const hasLineups    = matchFinished && cached?.lineups != null;
      const cachedAge     = cached?.syncedAt?.toDate ? Date.now() - cached.syncedAt.toDate().getTime() : Infinity;
      const finishedFresh = matchFinished && cachedAge < SCORERS_TTL_MS;

      const skipped = [
        hasHighlights && 'detail',
        hasLineups    && 'lineups',
        !matchStarted && 'stats',
        !matchStarted && 'incidents',
        finishedFresh && 'stats (TTL)',
        finishedFresh && 'incidents (TTL)',
      ].filter(Boolean);
      console.log(`  → Match ${e.id}: ${e.home_team} vs ${e.away_team}${skipped.length ? ` (saltado: ${skipped.join(', ')})` : ''}`);

      const [detail, stats, lineups, incidents] = await Promise.all([
        hasHighlights
          ? Promise.resolve(cached.detail)
          : fetchJson(`${BASE_URL}/events/${e.id}/`).catch(() => null),
        (matchStarted && !finishedFresh)
          ? fetchJson(`${BASE_URL}/events/${e.id}/stats`).catch(() => null)
          : Promise.resolve(cached?.stats ?? null),
        hasLineups
          ? Promise.resolve(cached.lineups)
          : fetchJson(`${BASE_URL}/events/${e.id}/lineups`).catch(() => null),
        (matchStarted && !finishedFresh)
          ? fetchJson(`${BASE_URL}/events/${e.id}/incidents`).catch(() => null)
          : Promise.resolve(cached?.incidents ?? null),
      ]);

      await db.collection('match_detail_cache_laliga').doc(String(e.id)).set({
        detail, stats, lineups, incidents,
        syncedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (err) {
      console.warn(`  ⚠ match ${e.id}: ${err.message}`);
    }
  }

  console.log(`Match details synced: ${qualifying.length} partidos (LaLiga)`);
}

async function main() {
  const backfill = process.argv.includes('--backfill');
  if (backfill) console.log('Modo backfill: sincronizando todos los partidos finalizados (LaLiga)…');
  const events = await fetchAllEvents();
  await syncEvents(events);
  await syncScorers();
  await syncMatchDetails(events, { backfill });
}
main().catch(err => { console.error(err); process.exit(1); });
