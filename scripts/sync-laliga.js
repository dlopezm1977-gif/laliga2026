// Sync La Liga matches from football-data.org → Firestore matches_cache
// Uso local:  node sync-laliga.js   (lee FOOTBALL_DATA_TOKEN de .env)
// Uso CI/CD:  FOOTBALL_DATA_TOKEN=xxx FIREBASE_SERVICE_ACCOUNT='{...}' node sync-laliga.js

const fs    = require('fs');
const path  = require('path');
const admin = require('firebase-admin');

// Cargar .env local si no hay variable de entorno ya definida
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
if (!FD_TOKEN) { console.error('Missing FOOTBALL_DATA_TOKEN (añádelo en scripts/.env)'); process.exit(1); }

const BZZOIRO_TOKEN = process.env.BZZOIRO_TOKEN;
if (!BZZOIRO_TOKEN) { console.error('Missing BZZOIRO_TOKEN (añádelo en scripts/.env)'); process.exit(1); }

// GitHub Actions: env var; local: file
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const BZ_BASE_URL  = 'https://sports.bzzoiro.com/api/v2';
const BZ_LEAGUE_ID = 3;
const BZ_SEASON_FROM = '2026-07-01';
const BZ_HEADERS   = { Authorization: `Token ${BZZOIRO_TOKEN}` };
const SCORERS_TTL_MS = 60 * 60 * 1000;
const LIVE_STATUSES  = new Set(['live', 'in_progress', 'halftime', '1st_half', '2nd_half', 'extra_time', 'penalties']);

async function fetchJson(url) {
  const res = await fetch(url, { headers: BZ_HEADERS });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} — ${url}\n${txt}`);
  }
  return res.json();
}

async function fetchAllEvents() {
  console.log('Fetching all LaLiga events from bzzoiro (paginated)…');
  const events = [];
  let url = `${BZ_BASE_URL}/events/?league_id=${BZ_LEAGUE_ID}&date_from=${BZ_SEASON_FROM}&limit=50`;
  while (url) {
    const data = await fetchJson(url);
    events.push(...data.results);
    url = data.next || null;
    if (url) console.log(`  Fetched ${events.length}/${data.count}…`);
  }
  console.log(`Got ${events.length} LaLiga events from bzzoiro`);
  return events;
}

async function syncMatchDetails(events) {
  const now = new Date();
  const fmt = d => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(d);
  const todayStr     = fmt(now);
  const yesterdayStr = fmt(new Date(now.getTime() - 24 * 60 * 60 * 1000));

  const qualifying = events.filter(e => {
    if (LIVE_STATUSES.has(e.status)) return true;
    if (!e.event_date) return false;
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
          : fetchJson(`${BZ_BASE_URL}/events/${e.id}/`).catch(() => null),
        (matchStarted && !finishedFresh)
          ? fetchJson(`${BZ_BASE_URL}/events/${e.id}/stats`).catch(() => null)
          : Promise.resolve(cached?.stats ?? null),
        hasLineups
          ? Promise.resolve(cached.lineups)
          : fetchJson(`${BZ_BASE_URL}/events/${e.id}/lineups`).catch(() => null),
        (matchStarted && !finishedFresh)
          ? fetchJson(`${BZ_BASE_URL}/events/${e.id}/incidents`).catch(() => null)
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

const SHORT_NAMES = {
  'Real Madrid CF':                'Real Madrid',
  'FC Barcelona':                  'Barcelona',
  'Club Atlético de Madrid':       'Atlético',
  'Sevilla FC':                    'Sevilla',
  'Real Betis Balompié':           'Betis',
  'Real Sociedad de Fútbol':       'Real Sociedad',
  'Villarreal CF':                 'Villarreal',
  'Athletic Club':                 'Athletic',
  'Valencia CF':                   'Valencia',
  'CA Osasuna':                    'Osasuna',
  'RC Celta de Vigo':              'Celta',
  'Getafe CF':                     'Getafe',
  'Rayo Vallecano de Madrid':      'Rayo',
  'Deportivo Alavés':              'Alavés',
  'RCD Espanyol de Barcelona':     'Espanyol',
  'Real Racing Club de Santander': 'Racing',
  'Levante UD':                    'Levante',
  'RC Deportivo La Coruña':        'Deportivo',
  'Elche CF':                      'Elche',
  'Málaga CF':                     'Málaga',
};
const short = name => SHORT_NAMES[name] || name;

async function syncScorers() {
  console.log('Fetching La Liga scorers…');
  // Intentar temporada actual, caer a la anterior si no hay datos
  for (const season of [2026, 2025]) {
    const res = await fetch(
      `https://api.football-data.org/v4/competitions/PD/scorers?season=${season}&limit=30`,
      { headers: { 'X-Auth-Token': FD_TOKEN } }
    );
    if (!res.ok) continue;
    const data = await res.json();
    if (!data.scorers?.length) continue;

    const scorers = data.scorers.map(s => ({
      name:          s.player.name,
      team:          s.team.shortName,
      teamAbbr:      s.team.tla,
      crestUrl:      s.team.crest,
      goals:         s.goals,
      assists:       s.assists ?? 0,
      penalties:     s.penalties ?? 0,
      playedMatches: s.playedMatches,
    }));

    await db.collection('scorers_cache').doc('laliga').set({
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      season,
      scorers,
    });
    console.log(`Scorers updated (season ${season}): ${scorers.length} jugadores`);
    return;
  }
  console.warn('No scorer data available for any season');
}

async function main() {
  console.log('Fetching La Liga matches from football-data.org…');
  const res = await fetch(
    'https://api.football-data.org/v4/competitions/PD/matches?season=2026',
    { headers: { 'X-Auth-Token': FD_TOKEN } }
  );
  if (!res.ok) {
    console.error(`API error ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const { matches } = await res.json();
  console.log(`Got ${matches.length} matches from API`);

  // Group by matchday
  const byMatchday = {};
  for (const m of matches) {
    const md = m.matchday;
    if (!md) continue;
    if (!byMatchday[md]) byMatchday[md] = [];
    byMatchday[md].push({
      matchId:   m.id,
      homeTeam:  short(m.homeTeam?.name || ''),
      awayTeam:  short(m.awayTeam?.name || ''),
      homeScore: m.score?.fullTime?.home ?? null,
      awayScore: m.score?.fullTime?.away ?? null,
      status:    m.status,
      utcDate:   m.utcDate,
    });
  }

  // Load existing cache to detect changes
  const existingSnap = await db.collection('matches_cache').get();
  const existing = {};
  existingSnap.forEach(d => { existing[d.id] = d.data(); });

  let updated = 0;
  const batch = db.batch();

  for (const [md, mdMatches] of Object.entries(byMatchday)) {
    const prev = existing[md];

    // Merge per-match: never overwrite a scored match with a scoreless one (API glitch guard)
    let mergedMatches = mdMatches;
    if (prev?.matches) {
      const prevById = Object.fromEntries(prev.matches.map(m => [m.matchId, m]));
      mergedMatches = mdMatches.map(m => {
        const old = prevById[m.matchId];
        const apiLostScore = old && old.homeScore != null && m.homeScore == null;
        if (apiLostScore) {
          console.warn(`  ⚠ MD${md} match ${m.matchId} (${m.homeTeam}-${m.awayTeam}): API devuelve sin goles, manteniendo datos anteriores (${old.homeScore}-${old.awayScore})`);
          return old;
        }
        return m;
      });
    }

    // Only write if something changed (status or score)
    const changed = !prev || JSON.stringify(prev.matches) !== JSON.stringify(mergedMatches);
    if (changed) {
      batch.set(db.collection('matches_cache').doc(md), {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        matches: mergedMatches,
      });
      updated++;
    }
  }

  if (updated > 0) {
    await batch.commit();
    console.log(`Updated ${updated} matchdays in Firestore`);
  } else {
    console.log('No changes detected, Firestore not updated');
  }
}

async function run() {
  await main();
  await syncScorers();
  const events = await fetchAllEvents();
  await syncMatchDetails(events);
}
run().catch(err => { console.error(err); process.exit(1); });
