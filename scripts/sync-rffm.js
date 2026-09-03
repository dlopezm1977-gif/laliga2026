// Sync RFFM Preferente Juvenil Grupo 2 → Firestore
// Local:  node scripts/sync-rffm.js   (lee .env de scripts/.env)
// CI/CD:  FIREBASE_SERVICE_ACCOUNT='{...}' node scripts/sync-rffm.js

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

const BASE_API    = 'https://www.rffm.es/api';
const LOGO_BASE   = 'https://appweb.rffm.es';
const ID_GROUP    = '26737720';
const TOTAL_ROUNDS = 34;
const CRESTS_DIR  = path.join(__dirname, '../public/crests-rffm');

if (!fs.existsSync(CRESTS_DIR)) fs.mkdirSync(CRESTS_DIR, { recursive: true });

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res.json();
}

function getExt(url) {
  const m = url.match(/\.([a-zA-Z]{2,4})(?:[?#]|$)/);
  return (m?.[1] ?? 'jpg').toLowerCase();
}

const logoCache = {};

async function downloadLogo(logoPath, teamCode) {
  if (!logoPath || !teamCode) return '';
  if (logoCache[teamCode]) return logoCache[teamCode];

  const ext = getExt(logoPath);
  const filename = `${teamCode}.${ext}`;
  const destPath = path.join(CRESTS_DIR, filename);
  const localRef = `crests-rffm/${filename}`;

  if (!fs.existsSync(destPath)) {
    try {
      const url = `${LOGO_BASE}${logoPath}`;
      const res = await fetch(url);
      if (res.ok) {
        const buf = await res.arrayBuffer();
        fs.writeFileSync(destPath, Buffer.from(buf));
        console.log(`  Logo descargado: ${filename}`);
      } else {
        console.warn(`  Logo no disponible (${res.status}): ${filename}`);
        logoCache[teamCode] = '';
        return '';
      }
    } catch (e) {
      console.warn(`  Error logo ${filename}: ${e.message}`);
      logoCache[teamCode] = '';
      return '';
    }
  }

  logoCache[teamCode] = localRef;
  return localRef;
}

function parseDate(fecha, hora) {
  if (!fecha) return null;
  const [d, m, y] = fecha.split('/');
  if (!d || !m || !y) return null;
  const t = hora?.trim() ?? '';
  return t ? `${y}-${m}-${d}T${t}` : `${y}-${m}-${d}`;
}

function normalizeTeamName(name) {
  return (name ?? '').replace(/'/g, '').replace(/\s+/g, ' ').trim();
}

function isPlayed(match) {
  return match.Goles_casa !== '' && match.Goles_casa != null &&
         match.Goles_visitante !== '' && match.Goles_visitante != null;
}

async function syncMatchesAndStandings() {
  console.log(`\nFetching ${TOTAL_ROUNDS} jornadas de RFFM…`);

  const allRounds = {};

  for (let round = 1; round <= TOTAL_ROUNDS; round++) {
    try {
      const url = `${BASE_API}/results?idGroup=${ID_GROUP}&round=${round}`;
      const data = await fetchJson(url);
      const partidos = data.partidos ?? [];

      if (partidos.length === 0) {
        console.log(`  Jornada ${round}: sin partidos`);
        continue;
      }

      const normalized = [];
      for (const m of partidos) {
        const [homeLogo, awayLogo] = await Promise.all([
          downloadLogo(m.url_img_local, m.CodEquipo_local),
          downloadLogo(m.url_img_visitante, m.CodEquipo_visitante),
        ]);

        const played = isPlayed(m);
        normalized.push({
          matchId:   m.codacta,
          homeTeam:  normalizeTeamName(m.Nombre_equipo_local),
          awayTeam:  normalizeTeamName(m.Nombre_equipo_visitante),
          homeCode:  m.CodEquipo_local,
          awayCode:  m.CodEquipo_visitante,
          homeLogo,
          awayLogo,
          homeScore: played ? parseInt(m.Goles_casa,       10) : null,
          awayScore: played ? parseInt(m.Goles_visitante,  10) : null,
          status:    m.partido_en_juego === '1' ? 'live' : played ? 'finished' : 'scheduled',
          fecha:     parseDate(m.fecha, m.hora),
          hora:      m.hora?.trim() ?? '',
          venue:     m.campojuego?.trim() ?? '',
          round,
        });
      }

      allRounds[round] = normalized;
      console.log(`  Jornada ${round}: ${partidos.length} partidos`);
    } catch (e) {
      console.warn(`  Jornada ${round} falló: ${e.message}`);
    }
  }

  // Determinar jornada actual
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  const rounds = Object.keys(allRounds).map(Number).sort((a, b) => a - b);

  let currentRound = rounds[0] ?? 1;

  // Live
  for (const rd of rounds) {
    if (allRounds[rd].some(m => m.status === 'live')) { currentRound = rd; break; }
  }

  // Hoy
  const todayRound = rounds.find(rd => allRounds[rd].some(m => m.fecha?.slice(0, 10) === today));
  if (todayRound) currentRound = todayRound;

  // Próxima jornada sin jugar
  const nextRound = rounds.find(rd => allRounds[rd].some(m => m.status !== 'finished' && m.fecha && m.fecha.slice(0, 10) >= today));
  if (nextRound && !todayRound) currentRound = nextRound;

  // Calcular clasificación a partir de resultados
  const teams = {};
  for (const rd of rounds) {
    for (const m of allRounds[rd]) {
      if (m.homeScore === null) continue;

      const h = m.homeCode, a = m.awayCode;
      if (!teams[h]) teams[h] = { code: h, name: m.homeTeam, logo: m.homeLogo, pj:0, pg:0, pe:0, pp:0, gf:0, gc:0, pts:0 };
      if (!teams[a]) teams[a] = { code: a, name: m.awayTeam, logo: m.awayLogo, pj:0, pg:0, pe:0, pp:0, gf:0, gc:0, pts:0 };

      const hg = m.homeScore, ag = m.awayScore;
      teams[h].pj++; teams[h].gf += hg; teams[h].gc += ag;
      teams[a].pj++; teams[a].gf += ag; teams[a].gc += hg;

      if (hg > ag)       { teams[h].pg++; teams[h].pts += 3; teams[a].pp++; }
      else if (hg === ag) { teams[h].pe++; teams[h].pts++;    teams[a].pe++; teams[a].pts++; }
      else               { teams[a].pg++; teams[a].pts += 3; teams[h].pp++; }
    }
  }

  // Si no hay resultados aún, poblar equipos desde fixtures
  if (Object.keys(teams).length === 0) {
    for (const rd of rounds) {
      for (const m of allRounds[rd]) {
        if (!teams[m.homeCode]) teams[m.homeCode] = { code: m.homeCode, name: m.homeTeam, logo: m.homeLogo, pj:0, pg:0, pe:0, pp:0, gf:0, gc:0, pts:0 };
        if (!teams[m.awayCode]) teams[m.awayCode] = { code: m.awayCode, name: m.awayTeam, logo: m.awayLogo, pj:0, pg:0, pe:0, pp:0, gf:0, gc:0, pts:0 };
      }
    }
  }

  const standings = Object.values(teams)
    .map(t => ({ ...t, gd: t.gf - t.gc }))
    .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.name.localeCompare(b.name));

  // Firestore — escribir en batches de 500 ops
  const BATCH_SIZE = 400;
  let batch = db.batch();
  let ops = 0;

  const flush = async () => {
    if (ops > 0) { await batch.commit(); batch = db.batch(); ops = 0; }
  };

  for (const [rd, matches] of Object.entries(allRounds)) {
    batch.set(db.collection('matches_cache_rffm').doc(String(rd)), {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      matches,
    });
    ops++;
    if (ops >= BATCH_SIZE) await flush();
  }

  batch.set(db.collection('matches_cache_rffm').doc('meta'), {
    updatedAt:    admin.firestore.FieldValue.serverTimestamp(),
    currentRound,
    totalRounds:  Object.keys(allRounds).length,
  });
  ops++;

  await flush();
  console.log(`\nPartidos sync: ${Object.keys(allRounds).length} jornadas, jornada actual = ${currentRound}`);

  await db.collection('standings_cache_rffm').doc('current').set({
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    standings,
  });
  console.log(`Clasificación: ${standings.length} equipos`);
}

async function syncScorers() {
  console.log('\nFetching goleadores…');
  try {
    const url = `${BASE_API}/scorers?idGroup=${ID_GROUP}`;
    const data = await fetchJson(url);
    const leaders = Array.isArray(data)
      ? data
      : (data.goleadores ?? data.scorers ?? data.leaders ?? data.results ?? []);

    await db.collection('scorers_cache_rffm').doc('current').set({
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      leaders,
    });
    console.log(`Goleadores: ${leaders.length}`);
  } catch (e) {
    console.warn(`Goleadores no disponibles (temporada no iniciada?): ${e.message}`);
    await db.collection('scorers_cache_rffm').doc('current').set({
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      leaders: [],
    });
  }
}

syncMatchesAndStandings()
  .then(() => syncScorers())
  .then(() => { console.log('\nSync RFFM completado.'); process.exit(0); })
  .catch(err => { console.error(err); process.exit(1); });
