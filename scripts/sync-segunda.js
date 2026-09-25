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

const LIVE_STATUSES = new Set(['live', 'in_progress', 'halftime', '1st_half', '2nd_half', 'extra_time', 'penalties']);

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
    console.log('No hay partidos de hoy/ayer para sincronizar detalles');
    return;
  }

  console.log(`Syncing details for ${qualifying.length} matches (hoy/ayer)…`);

  // Leer cache existente en paralelo para decidir qué endpoints saltar
  const cachedSnaps = await Promise.all(
    qualifying.map(e => db.collection('match_detail_cache_segunda').doc(String(e.id)).get())
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
        hasHighlights  && 'detail',
        hasLineups     && 'lineups',
        !matchStarted  && 'stats',
        !matchStarted  && 'incidents',
        finishedFresh  && 'stats (TTL)',
        finishedFresh  && 'incidents (TTL)',
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

      await db.collection('match_detail_cache_segunda').doc(String(e.id)).set({
        detail, stats, lineups, incidents,
        syncedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (err) {
      console.warn(`  ⚠ match ${e.id}: ${err.message}`);
    }
  }

  console.log(`Match details synced: ${qualifying.length} partidos`);
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
  const changedMatches = [];
  const finishedMatches = [];
  const goalMatches = [];

  for (const [rd, rdMatches] of Object.entries(byRound)) {
    const prev = existing[rd];
    const prevById = prev?.matches
      ? Object.fromEntries(prev.matches.map(m => [m.matchId, m]))
      : {};

    // Merge: nunca sobreescribir resultado con null (protección ante glitches de API)
    let merged = rdMatches;
    if (prev?.matches) {
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

    for (const m of merged) {
      const old = prevById[m.matchId];
      if (!old) continue;
      if (m.status === 'notstarted' && old.utcDate !== m.utcDate) changedMatches.push(m);
      if (m.status === 'finished' && old.status !== 'finished') finishedMatches.push(m);
      if (LIVE_STATUSES.has(m.status) && m.homeScore !== null) {
        const homeGoals = (m.homeScore ?? 0) - (old.homeScore ?? 0);
        const awayGoals = (m.awayScore ?? 0) - (old.awayScore ?? 0);
        if (homeGoals > 0 || awayGoals > 0) goalMatches.push(m);
      }
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

  return { events, changedMatches, finishedMatches, goalMatches };
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

const SCORERS_TTL_MS    = 60 * 60 * 1000; // 1 hora
const NOTIF_URL_SEGUNDA = '/laliga2026/?league=segunda&tab=resultados';

async function syncScorers() {
  // Comprobar si los datos son recientes para evitar ~20 llamadas de assists por ejecución
  const cached = await db.collection('scorers_cache_segunda').doc('current').get();
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

function formatMatchDate(utcDate) {
  if (!utcDate) return '';
  return new Date(utcDate).toLocaleString('es-ES', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Madrid',
  });
}

async function collectTokensByPref(prefPath, favTeamField) {
  const usersSnap = await db.collection('users').get();
  const allTokens = [];
  const favEntries = [];

  await Promise.all(usersSnap.docs.map(async doc => {
    const data = doc.data();
    const pref = prefPath.split('.').reduce((o, k) => o?.[k], data?.notifPrefs);
    if (!pref || pref === 'disabled') return;

    const tokSnap = await db.collection('users').doc(doc.id).collection('fcmTokens').get();
    const enabled = [];
    tokSnap.forEach(t => {
      const d = t.data();
      if (d.enabled && d.token) enabled.push({ token: d.token, label: d.label });
    });

    if (pref === 'all') {
      allTokens.push(...enabled);
    } else if (pref === 'favorite') {
      const fav = data[favTeamField] ?? null;
      favEntries.push(...enabled.map(e => ({ ...e, favoriteTeam: fav })));
    }
  }));

  return { allTokens, favEntries };
}

async function sendScheduleChangeNotifications(changedMatches) {
  if (changedMatches.length === 0) return;

  console.log(`\nCambios de horario: ${changedMatches.length} partido(s)`);
  changedMatches.forEach(m =>
    console.log(`  · ${m.homeTeam} vs ${m.awayTeam} → ${m.utcDate}`)
  );

  const { allTokens, favEntries } = await collectTokensByPref('scheduleChange.segunda', 'favoriteTeamSegunda');
  let totalOk = 0, totalErr = 0;

  for (const m of changedMatches) {
    const matchingFav = favEntries.filter(e => e.favoriteTeam === m.homeTeam || e.favoriteTeam === m.awayTeam);
    const recipients = [...allTokens, ...matchingFav];
    if (recipients.length === 0) continue;

    const when = formatMatchDate(m.utcDate);
    const body = `${m.homeTeam} vs ${m.awayTeam}${when ? ` · ${when}` : ''}`;
    const results = await Promise.all(recipients.map(async r => {
      try {
        await admin.messaging().send({
          token: r.token,
          webpush: {
            headers: { Urgency: 'normal' },
            data: { title: '🗓️ Cambio de horario — LaLiga Hypermotion', body, url: NOTIF_URL_SEGUNDA },
          },
        });
        return true;
      } catch { return false; }
    }));
    totalOk  += results.filter(Boolean).length;
    totalErr += results.filter(r => !r).length;
  }

  console.log(`  Notificaciones enviadas: ${totalOk} OK, ${totalErr} error(es)`);
}

async function sendMatchEndNotifications(finishedMatches) {
  if (finishedMatches.length === 0) return;

  console.log(`\nFinales de partido: ${finishedMatches.length} partido(s)`);
  finishedMatches.forEach(m =>
    console.log(`  · ${m.homeTeam} ${m.homeScore} - ${m.awayScore} ${m.awayTeam}`)
  );

  const { allTokens, favEntries } = await collectTokensByPref('matchEnd.segunda', 'favoriteTeamSegunda');
  let totalOk = 0, totalErr = 0;

  for (const m of finishedMatches) {
    const matchingFav = favEntries.filter(e => e.favoriteTeam === m.homeTeam || e.favoriteTeam === m.awayTeam);
    const recipients = [...allTokens, ...matchingFav];
    if (recipients.length === 0) continue;

    const body = `${m.homeTeam} ${m.homeScore} - ${m.awayScore} ${m.awayTeam}`;
    const results = await Promise.all(recipients.map(async r => {
      try {
        await admin.messaging().send({
          token: r.token,
          webpush: {
            headers: { Urgency: 'high' },
            data: { title: '⚽ Final — LaLiga Hypermotion', body, url: NOTIF_URL_SEGUNDA },
          },
        });
        return true;
      } catch { return false; }
    }));
    totalOk  += results.filter(Boolean).length;
    totalErr += results.filter(r => !r).length;
  }

  console.log(`  Notificaciones enviadas: ${totalOk} OK, ${totalErr} error(es)`);
}

async function sendGoalNotifications(goalMatches) {
  if (goalMatches.length === 0) return;

  console.log(`\nGoles en vivo: ${goalMatches.length} partido(s) con cambio de marcador`);
  goalMatches.forEach(m =>
    console.log(`  · ${m.homeTeam} ${m.homeScore} - ${m.awayScore} ${m.awayTeam}${m.currentMinute ? ` (min. ${m.currentMinute})` : ''}`)
  );

  const { allTokens, favEntries } = await collectTokensByPref('goals.segunda', 'favoriteTeamSegunda');
  let totalOk = 0, totalErr = 0;

  for (const m of goalMatches) {
    const matchingFav = favEntries.filter(e => e.favoriteTeam === m.homeTeam || e.favoriteTeam === m.awayTeam);
    const recipients = [...allTokens, ...matchingFav];
    if (recipients.length === 0) continue;

    const min = m.currentMinute ? ` · min. ${m.currentMinute}` : '';
    const body = `${m.homeTeam} ${m.homeScore} - ${m.awayScore} ${m.awayTeam}${min}`;
    const results = await Promise.all(recipients.map(async r => {
      try {
        await admin.messaging().send({
          token: r.token,
          webpush: {
            headers: { Urgency: 'high' },
            data: { title: '⚽ Gol — LaLiga Hypermotion', body, url: NOTIF_URL_SEGUNDA },
          },
        });
        return true;
      } catch { return false; }
    }));
    totalOk  += results.filter(Boolean).length;
    totalErr += results.filter(r => !r).length;
  }

  console.log(`  Notificaciones enviadas: ${totalOk} OK, ${totalErr} error(es)`);
}

async function main() {
  const backfill = process.argv.includes('--backfill');
  if (backfill) console.log('Modo backfill: sincronizando todos los partidos finalizados…');
  const { events, changedMatches, finishedMatches, goalMatches } = await syncEvents();
  await Promise.all([syncStandings(), syncScorers()]);
  await syncMatchDetails(events, { backfill });
  await sendScheduleChangeNotifications(changedMatches);
  await sendMatchEndNotifications(finishedMatches);
  await sendGoalNotifications(goalMatches);
}
main().catch(err => { console.error(err); process.exit(1); });
