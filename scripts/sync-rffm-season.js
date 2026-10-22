// Carga una temporada ARCHIVADA de RFFM (juvenil) → Firestore, con IDs prefijados por temporada.
// Uso:  node scripts/sync-rffm-season.js [temporada]     (por defecto 2526)
// No toca la temporada en curso (docs sin prefijo / 'current'); solo añade la temporada a meta.seasons.

const fs   = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { computeStandings } = require('./standings-rffm');

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : require('./serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const BASE_API  = 'https://www.rffm.es/api';
const LOGO_BASE = 'https://appweb.rffm.es';
const CRESTS_DIR = path.join(__dirname, '../public/crests-rffm');

const SEASONS = {
  '2526': {
    label: 'Segunda Juvenil Gr. 27 (Canal B)',
    idGroup: '24897940',
    idCompetition: '24897923',
    totalRounds: 30,
  },
};

SEASONS['2425'] = {
  label: 'Primera Cadete Gr. 14 (Canal A)',
  idGroup: '21433790',
  idCompetition: '21433776',
  totalRounds: 30,
};

SEASONS['2324'] = {
  label: 'Segunda Cadete Gr. 31 (Canal B)',
  idGroup: '17145535',
  idCompetition: '17145505',
  totalRounds: 26,
};

SEASONS['2223'] = {
  label: 'Preferente Infantil Gr. 3 (Canal A)',
  idGroup: '15292954',
  idCompetition: '15292951',
  totalRounds: 26,
};

SEASONS['2122'] = {
  label: 'Primera Infantil Gr. 11 (Canal B)',
  idGroup: '13564663',
  idCompetition: '13564652',
  totalRounds: 26,
};

const SEASON = process.argv[2] ?? '2526';
const CFG = SEASONS[SEASON];
if (!CFG) { console.error(`Temporada desconocida: ${SEASON}. Disponibles: ${Object.keys(SEASONS).join(', ')}`); process.exit(1); }

if (!fs.existsSync(CRESTS_DIR)) fs.mkdirSync(CRESTS_DIR, { recursive: true });

async function fetchJson(url, retries = 3, delayMs = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) return res.json();
      if (attempt < retries && [502, 503, 504].includes(res.status)) {
        await new Promise(r => setTimeout(r, delayMs));
        continue;
      }
      throw new Error(`HTTP ${res.status} — ${url}`);
    } catch (e) {
      clearTimeout(timer);
      if (attempt < retries && e.name === 'AbortError') continue;
      if (e.name === 'AbortError') throw new Error(`Timeout — ${url}`);
      throw e;
    }
  }
}

const logoCache = {};
async function downloadLogo(logoPath, teamCode) {
  if (!logoPath || !teamCode) return '';
  if (logoCache[teamCode] !== undefined) return logoCache[teamCode];
  const ext = (logoPath.match(/\.([a-zA-Z]{2,4})(?:[?#]|$)/)?.[1] ?? 'jpg').toLowerCase();
  const filename = `${teamCode}.${ext}`;
  const destPath = path.join(CRESTS_DIR, filename);
  if (!fs.existsSync(destPath)) {
    try {
      const res = await fetch(`${LOGO_BASE}${logoPath}`);
      if (!res.ok) { console.warn(`  Logo no disponible (${res.status}): ${filename}`); return (logoCache[teamCode] = ''); }
      fs.writeFileSync(destPath, Buffer.from(await res.arrayBuffer()));
      console.log(`  Logo descargado: ${filename}`);
    } catch (e) {
      console.warn(`  Error logo ${filename}: ${e.message}`);
      return (logoCache[teamCode] = '');
    }
  }
  return (logoCache[teamCode] = `crests-rffm/${filename}`);
}

function parseDate(fecha, hora) {
  if (!fecha) return null;
  const [d, m, y] = fecha.split('/');
  if (!d || !m || !y) return null;
  const t = hora?.trim() ?? '';
  return t ? `${y}-${m}-${d}T${t}` : `${y}-${m}-${d}`;
}

const normalizeTeamName = name => (name ?? '').replace(/'/g, '').replace(/\s+/g, ' ').trim();
const isPlayed = m => m.Goles_casa !== '' && m.Goles_casa != null && m.Goles_visitante !== '' && m.Goles_visitante != null;

async function syncMatches() {
  console.log(`\nJornadas ${SEASON} (${CFG.label}): 1..${CFG.totalRounds}`);
  const allRounds = {};
  const actaIds = new Set();
  const campoCodes = new Set();

  for (let round = 1; round <= CFG.totalRounds; round++) {
    let data = null;
    for (let t = 1; t <= 4 && !data; t++) {
      data = await fetchJson(`${BASE_API}/results?idGroup=${CFG.idGroup}&round=${round}`);
      if (!data) await new Promise(r => setTimeout(r, 2000));
    }
    if (!data) { console.warn(`  Jornada ${round}: la API devuelve null — omitida`); continue; }
    const partidos = data.partidos ?? [];
    if (!partidos.length) { console.log(`  Jornada ${round}: sin partidos`); continue; }

    const normalized = [];
    for (const m of partidos) {
      const [homeLogo, awayLogo] = await Promise.all([
        downloadLogo(m.url_img_local, m.CodEquipo_local),
        downloadLogo(m.url_img_visitante, m.CodEquipo_visitante),
      ]);
      const played = isPlayed(m);
      if (m.acta_cerrada === '1' && m.codacta) actaIds.add(String(m.codacta));
      if (m.codigo_campo?.trim()) campoCodes.add(m.codigo_campo.trim());
      normalized.push({
        matchId:   m.codacta,
        homeTeam:  normalizeTeamName(m.Nombre_equipo_local),
        awayTeam:  normalizeTeamName(m.Nombre_equipo_visitante),
        homeCode:  m.CodEquipo_local,
        awayCode:  m.CodEquipo_visitante,
        homeLogo,
        awayLogo,
        homeScore: played ? parseInt(m.Goles_casa, 10) : null,
        awayScore: played ? parseInt(m.Goles_visitante, 10) : null,
        status:    played ? 'finished' : 'scheduled',
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
  }

  const standings = computeStandings(allRounds);

  let batch = db.batch();
  let ops = 0;
  for (const [rd, matches] of Object.entries(allRounds)) {
    batch.set(db.collection('matches_cache_rffm').doc(`${SEASON}_${rd}`), {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      matches,
    });
    if (++ops >= 400) { await batch.commit(); batch = db.batch(); ops = 0; }
  }
  // Registrar la temporada sin pisar currentSeason / currentRound de la temporada en curso
  batch.set(db.collection('matches_cache_rffm').doc('meta'), {
    seasons: admin.firestore.FieldValue.arrayUnion(SEASON),
  }, { merge: true });
  batch.set(db.collection('matches_cache_rffm').doc(`meta_${SEASON}`), {
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    totalRounds: Object.keys(allRounds).length,
    label: CFG.label,
  });
  batch.set(db.collection('standings_cache_rffm').doc(SEASON), {
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    standings,
  });
  await batch.commit();
  console.log(`\nPartidos: ${Object.keys(allRounds).length} jornadas · Clasificación: ${standings.length} equipos`);
  return { actaIds, campoCodes };
}

async function syncScorers() {
  console.log('\nGoleadores…');
  let data = null;
  for (let t = 1; t <= 3 && !data; t++) {
    data = await fetchJson(`${BASE_API}/scorers?idGroup=${CFG.idGroup}&idCompetition=${CFG.idCompetition}`);
    if (!data) await new Promise(r => setTimeout(r, 2000));
  }
  if (!data) console.warn('  La API de goleadores devuelve null (sin datos para esta temporada)');
  const leaders = !data ? [] : Array.isArray(data) ? data : (data.goles ?? data.goleadores ?? data.scorers ?? data.leaders ?? data.results ?? []);
  // Descargar escudos de equipos que solo aparezcan aquí
  for (const s of leaders) await downloadLogo(s.escudo_equipo, s.codigo_equipo);
  await db.collection('scorers_cache_rffm').doc(SEASON).set({
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    leaders,
  });
  console.log(`Goleadores: ${leaders.length}`);
}

async function getBuildId() {
  const html = await fetch('https://www.rffm.es/').then(r => r.text());
  const m = html.match(/"buildId":"([^"]+)"/);
  if (!m) throw new Error('No se pudo obtener el buildId de RFFM');
  return m[1];
}

function mapCards(raw) {
  const seen = {};
  return [...(raw ?? [])].sort((a, b) => parseInt(a.minuto) - parseInt(b.minuto)).map(t => {
    let segundaAmarilla = t.segunda_amarilla === '1';
    if (t.codigo_tipo_amonestacion === '100' && !segundaAmarilla) {
      if (seen[t.codjugador]) segundaAmarilla = true; else seen[t.codjugador] = true;
    }
    return { cod: t.codjugador, nombre: t.nombre_jugador, minuto: parseInt(t.minuto, 10), tipo: t.codigo_tipo_amonestacion, segundaAmarilla };
  });
}

function buildActa(g) {
  const mapPlayer = p => ({
    cod: p.codjugador, dorsal: p.dorsal, nombre: p.nombre_jugador,
    titular: p.titular === '1', suplente: p.suplente === '1', capitan: p.capitan === '1', portero: p.portero === '1',
    posicion: p.posicion ?? '', posicionAbrev: p.posicion_jugador_abreviatura ?? '',
  });
  const mapGoal = (gl, ownGoal) => ({ cod: gl.codjugador, nombre: gl.nombre_jugador, minuto: parseInt(gl.minuto, 10), tipo: gl.tipo_gol, ...(ownGoal && { ownGoal: true }) });
  const mapSub = s => ({ minuto: parseInt(s.minuto, 10), entra: { cod: s.codjugador_entra, nombre: s.nombre_jugador_entra, dorsal: s.entradorsal }, sale: { cod: s.codjugador_sale, nombre: s.nombre_jugador_sale, dorsal: s.saledorsal } });
  const loc = g.goles_equipo_local ?? [];
  const vis = g.goles_equipo_visitante ?? [];
  const coach = (name, cod) => name?.trim() ? { cod, nombre: name.trim() } : null;

  return {
    syncedAt: admin.firestore.FieldValue.serverTimestamp(),
    detail: {
      codacta: g.codacta,
      suspended: g.suspendido === '1',
      home: { code: g.codigo_equipo_local,     name: normalizeTeamName(g.equipo_local),     score: parseInt(g.goles_local, 10),     formation: g.esquema_local ?? '' },
      away: { code: g.codigo_equipo_visitante, name: normalizeTeamName(g.equipo_visitante), score: parseInt(g.goles_visitante, 10), formation: g.esquema_visitante ?? '' },
      penalties: g.hay_penaltis === '1' ? { home: parseInt(g.penaltis_casa, 10), away: parseInt(g.penaltis_fuera, 10), goals: g.goles_penalti ?? [] } : null,
    },
    lineups: {
      homeFormation: g.esquema_local ?? '',
      awayFormation: g.esquema_visitante ?? '',
      homeCoach: coach(g.entrenador_local, g.cod_entrenador_local),
      awayCoach: coach(g.entrenador_visitante, g.cod_entrenador_visitante),
      home: (g.jugadores_equipo_local ?? []).map(mapPlayer),
      away: (g.jugadores_equipo_visitante ?? []).map(mapPlayer),
    },
    incidents: {
      goals: {
        home: [...loc.filter(x => x.tipo_gol !== '102').map(x => mapGoal(x, false)), ...vis.filter(x => x.tipo_gol === '102').map(x => mapGoal(x, true))].sort((a, b) => a.minuto - b.minuto),
        away: [...vis.filter(x => x.tipo_gol !== '102').map(x => mapGoal(x, false)), ...loc.filter(x => x.tipo_gol === '102').map(x => mapGoal(x, true))].sort((a, b) => a.minuto - b.minuto),
      },
      cards: { home: mapCards(g.tarjetas_equipo_local), away: mapCards(g.tarjetas_equipo_visitante) },
      subs: { home: (g.sustituciones_equipo_local ?? []).map(mapSub), away: (g.sustituciones_equipo_visitante ?? []).map(mapSub) },
    },
    referees: (g.arbitros_partido ?? []).map(r => ({ cod: r.cod_arbitro, nombre: r.nombre_arbitro, tipo: r.tipo_arbitro })),
  };
}

async function syncActas(actaIds, buildId) {
  const ids = [...actaIds];
  const cached = await Promise.all(ids.map(id => db.collection('match_detail_cache_rffm').doc(id).get()));
  const toFetch = ids.filter((_, i) => !cached[i].exists);
  console.log(`\nActas: ${ids.length} cerradas, ${ids.length - toFetch.length} ya en caché, ${toFetch.length} a descargar`);

  let ok = 0, fail = 0;
  for (const codacta of toFetch) {
    try {
      let g = null;
      for (let t = 1; t <= 4 && !g; t++) {
        const data = await fetchJson(`https://www.rffm.es/_next/data/${buildId}/acta-partido/${codacta}.json`);
        g = data?.pageProps?.game;
        if (!g) await new Promise(r => setTimeout(r, 1500));
      }
      if (!g) { console.warn(`  Acta ${codacta}: sin datos`); fail++; continue; }
      await db.collection('match_detail_cache_rffm').doc(codacta).set(buildActa(g));
      ok++;
      if (ok % 20 === 0) console.log(`  ${ok}/${toFetch.length}…`);
    } catch (e) {
      fail++;
      console.warn(`  Acta ${codacta} falló: ${e.message}`);
    }
  }
  console.log(`Actas sync: ${ok} OK, ${fail} con error`);
}

async function syncCampos(campoCodes, buildId) {
  const codes = [...campoCodes];
  const cached = await Promise.all(codes.map(c => db.collection('campos_cache_rffm').doc(c).get()));
  const toFetch = codes.filter((_, i) => !cached[i].exists);
  console.log(`\nCampos: ${codes.length} en total, ${toFetch.length} nuevos`);
  for (const code of toFetch) {
    try {
      const data = await fetchJson(`https://www.rffm.es/_next/data/${buildId}/campo/${code}.json?codcampo=${code}`);
      const f = data?.pageProps?.field;
      if (!f) continue;
      await db.collection('campos_cache_rffm').doc(code).set({
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        nombre: f.nombre_campo ?? '', direccion: f.direccion ?? '', localidad: f.localidad ?? '',
        superficie: f.superficie_juego ?? '', tipo: f.tipo_campo ?? '', lat: f.latitud ?? '', lng: f.longitud ?? '', imagen: f.imagen_campo ?? '',
      });
    } catch (e) {
      console.warn(`  Campo ${code} falló: ${e.message}`);
    }
  }
}

async function main() {
  const { actaIds, campoCodes } = await syncMatches();
  await syncScorers();
  const buildId = await getBuildId();
  await syncActas(actaIds, buildId);
  await syncCampos(campoCodes, buildId);
  console.log(`\nTemporada ${SEASON} cargada.`);
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
