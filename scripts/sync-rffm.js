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
  const actaIds = new Set();

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
        if (m.acta_cerrada === '1' && m.codacta) actaIds.add(String(m.codacta));
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
          actaCerrada: m.acta_cerrada === '1',
          fecha:     parseDate(m.fecha, m.hora),
          hora:      m.hora?.trim() ?? '',
          venue:     m.campojuego?.trim() ?? '',
          venueCode: m.codigo_campo?.trim() ?? '',
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

  const campoCodes = new Set(
    Object.values(allRounds).flat().map(m => m.venueCode).filter(Boolean)
  );
  return { campoCodes, actaIds };
}

async function getRffmBuildId() {
  try {
    const html = await fetch('https://www.rffm.es/').then(r => r.text());
    const m = html.match(/"buildId":"([^"]+)"/);
    return m?.[1] ?? null;
  } catch { return null; }
}

async function syncCampos(campoCodes, buildId) {
  if (!buildId) { console.warn('\nNo se pudo obtener el buildId de RFFM — campos no sincronizados'); return; }

  console.log(`\nFetching datos de ${campoCodes.size} campos (buildId: ${buildId})…`);
  let batch = db.batch();
  let ops = 0;

  for (const code of campoCodes) {
    if (!code) continue;
    try {
      const url = `https://www.rffm.es/_next/data/${buildId}/campo/${code}.json?codcampo=${code}`;
      const data = await fetchJson(url);
      const f = data?.pageProps?.field;
      if (!f) continue;

      batch.set(db.collection('campos_cache_rffm').doc(String(code)), {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        nombre:     f.nombre_campo     ?? '',
        direccion:  f.direccion        ?? '',
        localidad:  f.localidad        ?? '',
        superficie: f.superficie_juego ?? '',
        tipo:       f.tipo_campo       ?? '',
        lat:        f.latitud          ?? '',
        lng:        f.longitud         ?? '',
        imagen:     f.imagen_campo     ?? '',
      });
      ops++;
      if (ops % 20 === 0) { await batch.commit(); batch = db.batch(); ops = 0; }
      console.log(`  Campo ${code}: ${f.nombre_campo}`);
    } catch (e) {
      console.warn(`  Campo ${code} falló: ${e.message}`);
    }
  }

  if (ops > 0) await batch.commit();
  console.log('Campos sync completado.');
}

async function syncActas(actaIds, buildId) {
  if (!buildId) { console.warn('\nNo buildId — actas no sincronizadas'); return; }
  if (actaIds.size === 0) { console.log('\nNo hay actas cerradas que sincronizar'); return; }

  console.log(`\nFetching ${actaIds.size} actas cerradas (buildId: ${buildId})…`);

  const ids = [...actaIds];
  const cachedSnaps = await Promise.all(
    ids.map(id => db.collection('match_detail_cache_rffm').doc(id).get())
  );
  const toFetch = ids.filter((_, i) => !cachedSnaps[i].exists);
  console.log(`  ${ids.length - toFetch.length} ya en caché, ${toFetch.length} a descargar`);

  let batch = db.batch();
  let ops = 0;

  for (const codacta of toFetch) {
    try {
      const url = `https://www.rffm.es/_next/data/${buildId}/acta-partido/${codacta}.json`;
      const data = await fetchJson(url);
      const g = data?.pageProps?.game;
      if (!g) { console.warn(`  Acta ${codacta}: sin datos`); continue; }

      const mapPlayer = p => ({
        cod:          p.codjugador,
        dorsal:       p.dorsal,
        nombre:       p.nombre_jugador,
        titular:      p.titular === '1',
        suplente:     p.suplente === '1',
        capitan:      p.capitan === '1',
        portero:      p.portero === '1',
        posicion:     p.posicion ?? '',
        posicionAbrev: p.posicion_jugador_abreviatura ?? '',
      });

      batch.set(db.collection('match_detail_cache_rffm').doc(codacta), {
        syncedAt: admin.firestore.FieldValue.serverTimestamp(),
        detail: {
          codacta:   g.codacta,
          suspended: g.suspendido === '1',
          home: {
            code:      g.codigo_equipo_local,
            name:      normalizeTeamName(g.equipo_local),
            score:     parseInt(g.goles_local, 10),
            formation: g.esquema_local ?? '',
          },
          away: {
            code:      g.codigo_equipo_visitante,
            name:      normalizeTeamName(g.equipo_visitante),
            score:     parseInt(g.goles_visitante, 10),
            formation: g.esquema_visitante ?? '',
          },
          penalties: g.hay_penaltis === '1' ? {
            home:  parseInt(g.penaltis_casa,  10),
            away:  parseInt(g.penaltis_fuera, 10),
            goals: g.goles_penalti ?? [],
          } : null,
        },
        lineups: {
          homeFormation: g.esquema_local      ?? '',
          awayFormation: g.esquema_visitante  ?? '',
          homeCoach: g.entrenador_local?.trim()
            ? { cod: g.cod_entrenador_local,      nombre: g.entrenador_local.trim()      } : null,
          awayCoach: g.entrenador_visitante?.trim()
            ? { cod: g.cod_entrenador_visitante,  nombre: g.entrenador_visitante.trim()  } : null,
          home: (g.jugadores_equipo_local     ?? []).map(mapPlayer),
          away: (g.jugadores_equipo_visitante ?? []).map(mapPlayer),
        },
        incidents: {
          goals: {
            home: (g.goles_equipo_local     ?? []).map(gl => ({ cod: gl.codjugador, nombre: gl.nombre_jugador, minuto: parseInt(gl.minuto, 10), tipo: gl.tipo_gol })),
            away: (g.goles_equipo_visitante ?? []).map(gl => ({ cod: gl.codjugador, nombre: gl.nombre_jugador, minuto: parseInt(gl.minuto, 10), tipo: gl.tipo_gol })),
          },
          cards: {
            home: (g.tarjetas_equipo_local     ?? []).map(t => ({ cod: t.codjugador, nombre: t.nombre_jugador, minuto: parseInt(t.minuto, 10), tipo: t.codigo_tipo_amonestacion, segundaAmarilla: t.segunda_amarilla === '1' })),
            away: (g.tarjetas_equipo_visitante ?? []).map(t => ({ cod: t.codjugador, nombre: t.nombre_jugador, minuto: parseInt(t.minuto, 10), tipo: t.codigo_tipo_amonestacion, segundaAmarilla: t.segunda_amarilla === '1' })),
          },
          subs: {
            home: (g.sustituciones_equipo_local     ?? []).map(s => ({ minuto: parseInt(s.minuto, 10), entra: { cod: s.codjugador_entra, nombre: s.nombre_jugador_entra, dorsal: s.entradorsal }, sale: { cod: s.codjugador_sale, nombre: s.nombre_jugador_sale, dorsal: s.saledorsal } })),
            away: (g.sustituciones_equipo_visitante ?? []).map(s => ({ minuto: parseInt(s.minuto, 10), entra: { cod: s.codjugador_entra, nombre: s.nombre_jugador_entra, dorsal: s.entradorsal }, sale: { cod: s.codjugador_sale, nombre: s.nombre_jugador_sale, dorsal: s.saledorsal } })),
          },
        },
        referees: (g.arbitros_partido ?? []).map(r => ({ cod: r.cod_arbitro, nombre: r.nombre_arbitro, tipo: r.tipo_arbitro })),
      });

      ops++;
      if (ops % 20 === 0) { await batch.commit(); batch = db.batch(); ops = 0; }
      console.log(`  Acta ${codacta}: OK`);
    } catch (e) {
      console.warn(`  Acta ${codacta} falló: ${e.message}`);
    }
  }

  if (ops > 0) await batch.commit();
  console.log('Actas sync completado.');
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

async function main() {
  const { campoCodes, actaIds } = await syncMatchesAndStandings();
  const buildId = await getRffmBuildId();
  if (!buildId) console.warn('No se pudo obtener el buildId de RFFM');
  await syncCampos(campoCodes, buildId);
  await syncActas(actaIds, buildId);
  await syncScorers();
  console.log('\nSync RFFM completado.');
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
