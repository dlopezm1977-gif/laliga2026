// One-shot: fuerza la descarga de un acta RFFM concreta (ignora caché)
// Uso: node scripts/test-acta-rffm.js 5387074

const fs    = require('fs');
const path  = require('path');
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

function normalizeTeamName(name) {
  return (name ?? '').replace(/'/g, '').replace(/\s+/g, ' ').trim();
}

async function getRffmBuildId() {
  const html = await fetch('https://www.rffm.es/').then(r => r.text());
  const m = html.match(/"buildId":"([^"]+)"/);
  if (!m) throw new Error('No se pudo extraer el buildId de RFFM');
  return m[1];
}

async function fetchActa(codacta, buildId) {
  const url = `https://www.rffm.es/_next/data/${buildId}/acta-partido/${codacta}.json`;
  console.log(`Fetching: ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function main() {
  const codacta = process.argv[2] ?? '5387074';
  console.log(`\nForzando acta ${codacta}…`);

  const buildId = await getRffmBuildId();
  console.log(`buildId: ${buildId}`);

  const data = await fetchActa(codacta, buildId);
  const g = data?.pageProps?.game;
  if (!g) throw new Error('pageProps.game no encontrado en la respuesta');

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

  const doc = {
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
        ? { cod: g.cod_entrenador_local,     nombre: g.entrenador_local.trim()     } : null,
      awayCoach: g.entrenador_visitante?.trim()
        ? { cod: g.cod_entrenador_visitante, nombre: g.entrenador_visitante.trim() } : null,
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
  };

  await db.collection('match_detail_cache_rffm').doc(codacta).set(doc);
  console.log(`\nActa ${codacta} guardada en match_detail_cache_rffm/${codacta}`);
  console.log(`  ${g.equipo_local} ${g.goles_local} - ${g.goles_visitante} ${g.equipo_visitante}`);
  console.log(`  Jugadores local: ${(g.jugadores_equipo_local ?? []).length}`);
  console.log(`  Jugadores visitante: ${(g.jugadores_equipo_visitante ?? []).length}`);
  console.log(`  Goles: ${(g.goles_equipo_local ?? []).length + (g.goles_equipo_visitante ?? []).length}`);
  console.log(`  Tarjetas: ${(g.tarjetas_equipo_local ?? []).length + (g.tarjetas_equipo_visitante ?? []).length}`);
  console.log(`  Árbitros: ${(g.arbitros_partido ?? []).map(r => r.nombre_arbitro).join(', ')}`);
}

main().then(() => process.exit(0)).catch(err => { console.error(err.message); process.exit(1); });
