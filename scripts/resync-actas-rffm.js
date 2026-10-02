/**
 * Re-sincroniza las actas de partidos RFFM de las jornadas indicadas.
 * Uso: node resync-actas-rffm.js 1 2 3
 */
const admin = require('firebase-admin');
const sa    = require('./serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const ROUNDS = process.argv.slice(2).map(Number).filter(Boolean);
if (!ROUNDS.length) { console.error('Indica las jornadas: node resync-actas-rffm.js 1 2 3'); process.exit(1); }

async function getBuildId() {
  const html = await fetch('https://www.rffm.es/').then(r => r.text());
  const m = html.match(/"buildId":"([^"]+)"/);
  if (!m) throw new Error('No se pudo extraer buildId');
  return m[1];
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}

function mapCards(raw) {
  const seen = {};
  return [...(raw ?? [])].sort((a, b) => parseInt(a.minuto) - parseInt(b.minuto)).map(t => {
    let segundaAmarilla = t.segunda_amarilla === '1';
    if (t.codigo_tipo_amonestacion === '100' && !segundaAmarilla) {
      if (seen[t.codjugador]) { segundaAmarilla = true; } else { seen[t.codjugador] = true; }
    }
    return { cod: t.codjugador, nombre: t.nombre_jugador, minuto: parseInt(t.minuto, 10), tipo: t.codigo_tipo_amonestacion, segundaAmarilla };
  });
}

async function syncActa(codacta, buildId) {
  const url  = `https://www.rffm.es/_next/data/${buildId}/acta-partido/${codacta}.json`;
  const data = await fetchJson(url);
  const g    = data?.pageProps?.game;
  if (!g) { console.warn(`  ${codacta}: sin datos`); return; }

  const mapPlayer = p => ({ cod: p.codjugador, dorsal: p.dorsal, nombre: p.nombre_jugador, titular: p.titular === '1', suplente: p.suplente === '1', capitan: p.capitan === '1', portero: p.portero === '1', posicion: p.posicion ?? '', posicionAbrev: p.posicion_jugador_abreviatura ?? '' });
  const mapGoal   = (gl, ownGoal) => ({ cod: gl.codjugador, nombre: gl.nombre_jugador, minuto: parseInt(gl.minuto, 10), tipo: gl.tipo_gol, ...(ownGoal && { ownGoal: true }) });
  const loc = g.goles_equipo_local     ?? [];
  const vis = g.goles_equipo_visitante ?? [];

  const doc = {
    syncedAt: admin.firestore.FieldValue.serverTimestamp(),
    detail: {
      codacta:   g.codacta,
      suspended: g.suspendido === '1',
      home: { name: g.equipo_local,     score: parseInt(g.goles_local,      10) },
      away: { name: g.equipo_visitante, score: parseInt(g.goles_visitante,   10) },
      penalties: g.hay_penaltis === '1' ? { home: parseInt(g.penaltis_casa, 10), away: parseInt(g.penaltis_fuera, 10), goals: g.goles_penalti ?? [] } : null,
    },
    lineups: {
      homeFormation: g.esquema_local     ?? '',
      awayFormation: g.esquema_visitante ?? '',
      homeCoach: g.entrenador_local?.trim()
        ? { cod: g.cod_entrenador_local,     nombre: g.entrenador_local.trim()     } : null,
      awayCoach: g.entrenador_visitante?.trim()
        ? { cod: g.cod_entrenador_visitante, nombre: g.entrenador_visitante.trim() } : null,
      home: (g.jugadores_equipo_local     ?? []).map(mapPlayer),
      away: (g.jugadores_equipo_visitante ?? []).map(mapPlayer),
    },
    incidents: {
      goals: {
        home: [...loc.filter(gl => gl.tipo_gol !== '102').map(gl => mapGoal(gl, false)), ...vis.filter(gl => gl.tipo_gol === '102').map(gl => mapGoal(gl, true))].sort((a, b) => a.minuto - b.minuto),
        away: [...vis.filter(gl => gl.tipo_gol !== '102').map(gl => mapGoal(gl, false)), ...loc.filter(gl => gl.tipo_gol === '102').map(gl => mapGoal(gl, true))].sort((a, b) => a.minuto - b.minuto),
      },
      cards: { home: mapCards(g.tarjetas_equipo_local), away: mapCards(g.tarjetas_equipo_visitante) },
      subs: {
        home: (g.sustituciones_equipo_local     ?? []).map(s => ({ minuto: parseInt(s.minuto, 10), entra: { cod: s.codjugador_entra, nombre: s.nombre_jugador_entra, dorsal: s.entradorsal }, sale: { cod: s.codjugador_sale, nombre: s.nombre_jugador_sale, dorsal: s.saledorsal } })),
        away: (g.sustituciones_equipo_visitante ?? []).map(s => ({ minuto: parseInt(s.minuto, 10), entra: { cod: s.codjugador_entra, nombre: s.nombre_jugador_entra, dorsal: s.entradorsal }, sale: { cod: s.codjugador_sale, nombre: s.nombre_jugador_sale, dorsal: s.saledorsal } })),
      },
    },
    referees: (g.arbitros_partido ?? []).map(r => ({ cod: r.cod_arbitro, nombre: r.nombre_arbitro, tipo: r.tipo_arbitro })),
  };

  await db.collection('match_detail_cache_rffm').doc(String(codacta)).set(doc);
  console.log(`  ✓ ${codacta}: ${g.equipo_local} ${g.goles_local}-${g.goles_visitante} ${g.equipo_visitante}`);
}

async function main() {
  const buildId = await getBuildId();
  console.log(`buildId: ${buildId}`);

  for (const rd of ROUNDS) {
    console.log(`\nJornada ${rd}…`);
    const snap = await db.collection('matches_cache_rffm').doc(String(rd)).get();
    if (!snap.exists) { console.log(`  Sin datos en Firestore`); continue; }

    const matches = snap.data().matches ?? [];
    const withActa = matches.filter(m => m.matchId);
    console.log(`  ${withActa.length} partidos con acta`);

    for (const m of withActa) {
      try {
        await syncActa(m.matchId, buildId);
      } catch (e) {
        console.warn(`  ✗ ${m.matchId}: ${e.message}`);
      }
    }
  }

  console.log('\nHecho.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
