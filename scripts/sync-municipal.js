// Sync Liga Municipal (JDM) → Firestore
// Local:  node scripts/sync-municipal.js   (lee .env de scripts/.env)
// CI/CD:  FIREBASE_SERVICE_ACCOUNT='{...}' node scripts/sync-municipal.js

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

const SEASON        = '2627';
const MATCHES_URL   = 'https://datos.madrid.es/api/3/action/datastore_search?resource_id=211549-0-juegos-deportivos-actual-csv&limit=500&q=30797';
const STANDINGS_URL = 'https://datos.madrid.es/api/3/action/datastore_search?resource_id=211549-2-juegos-deportivos-actual-csv&limit=100&q=30797';

// Plan B: si el datastore no responde (404 al dejar de publicarse sus metadatos), se descarga el CSV completo
const GROUP_CODE    = '30797';
const RESOURCE_SHOW = id => `https://datos.madrid.es/api/3/action/resource_show?id=${id}`;
const MATCHES_RES   = '211549-0-juegos-deportivos-actual-csv';
const STANDINGS_RES = '211549-2-juegos-deportivos-actual-csv';

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ';') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// Descarga el CSV vigente (la URL cambia con cada publicación) y devuelve los registros del grupo como objetos
async function fetchCsvRecords(resourceId) {
  const showRes = await fetch(RESOURCE_SHOW(resourceId));
  if (!showRes.ok) throw new Error(`resource_show ${resourceId}: HTTP ${showRes.status}`);
  const url = (await showRes.json()).result?.url;
  if (!url) throw new Error(`resource_show ${resourceId}: sin url de descarga`);
  const csvRes = await fetch(url);
  if (!csvRes.ok) throw new Error(`CSV ${url}: HTTP ${csvRes.status}`);
  const text = new TextDecoder('windows-1252').decode(await csvRes.arrayBuffer()).replace(/^﻿/, '');
  const [header, ...rows] = parseCsv(text);
  const col = header.indexOf('Codigo_grupo');
  return rows
    .filter(r => r[col] === GROUP_CODE)
    .map(r => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

async function fetchRecords(apiUrl, resourceId) {
  try {
    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.success === false) throw new Error('success=false');
    return json.result?.records ?? [];
  } catch (err) {
    console.warn(`API datastore no disponible (${err.message}); usando descarga CSV`);
    return fetchCsvRecords(resourceId);
  }
}

function normalizeMatch(r) {
  const finished = r.Estado === 'F';
  return {
    homeTeam:  r.Equipo_local,
    awayTeam:  r.Equipo_visitante,
    homeScore: finished ? Number(r.Resultado1) : null,
    awayScore: finished ? Number(r.Resultado2) : null,
    status:    finished ? 'finished' : 'scheduled',
    jornada:   Number(r.Jornada),
    fecha:     r.Fecha,
    hora:      r.Hora,
    campo:     r.Campo,
  };
}

function detectCurrentRound(roundData) {
  const rounds = Object.keys(roundData).map(Number).sort((a, b) => a - b);
  if (!rounds.length) return 1;
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  const todayRound = rounds.find(rd => roundData[rd].some(m => m.fecha === today));
  if (todayRound) return todayRound;
  // Jornada del partido pendiente más próximo (un aplazado reprogramado a lejos no secuestra la jornada)
  let nextRound = null, nextDate = null;
  for (const rd of rounds) {
    for (const m of roundData[rd]) {
      if (m.status !== 'scheduled' || !m.fecha || m.fecha < today) continue;
      if (nextDate === null || m.fecha < nextDate) { nextDate = m.fecha; nextRound = rd; }
    }
  }
  if (nextRound) return nextRound;
  return rounds[rounds.length - 1];
}

async function syncMatches() {
  console.log('\nFetching partidos de la Liga Municipal…');
  const records = await fetchRecords(MATCHES_URL, MATCHES_RES);

  const all = {};
  for (const r of records) {
    const jornada = Number(r.Jornada);
    if (!all[jornada]) all[jornada] = [];
    all[jornada].push(normalizeMatch(r));
  }

  const rounds      = Object.keys(all).map(Number);
  const totalRounds = rounds.length > 0 ? Math.max(...rounds) : 22;
  const currentRound = detectCurrentRound(all);

  const BATCH_SIZE = 400;
  let batch = db.batch();
  let ops   = 0;

  const flush = async () => {
    if (ops > 0) { await batch.commit(); batch = db.batch(); ops = 0; }
  };

  for (const [rd, matches] of Object.entries(all)) {
    // Conserva el detalle manual (alineación/incidencias) que no viene de la API
    const ref = db.collection('matches_cache_municipal').doc(`${SEASON}_${rd}`);
    const existing = await ref.get();
    if (existing.exists) {
      const key = m => `${m.fecha}|${m.hora}|${m.homeTeam}|${m.awayTeam}`;
      const details = new Map((existing.data().matches ?? []).filter(m => m.detail).map(m => [key(m), m.detail]));
      for (const m of matches) {
        const d = details.get(key(m));
        if (d) m.detail = d;
      }
    }
    batch.set(db.collection('matches_cache_municipal').doc(`${SEASON}_${rd}`), {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      matches,
    });
    ops++;
    if (ops >= BATCH_SIZE) await flush();
  }

  const existingMeta = await db.collection('matches_cache_municipal').doc('meta').get();
  const existingSeasons = existingMeta.exists ? (existingMeta.data().seasons ?? []) : [];
  const seasons = [...new Set([...existingSeasons, SEASON])].sort();

  batch.set(db.collection('matches_cache_municipal').doc('meta'), {
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    currentSeason: SEASON,
    seasons,
    currentRound,
    totalRounds,
  });
  ops++;
  await flush();

  console.log(`Partidos sync: ${Object.keys(all).length} jornadas, jornada actual = ${currentRound}`);
  return all;
}

async function syncStandings(matchData = {}) {
  console.log('\nFetching clasificación de la Liga Municipal…');
  const records = await fetchRecords(STANDINGS_URL, STANDINGS_RES);

  let standings;
  if (records.length > 0) {
    standings = records
      .map(r => ({
        position: Number(r.Posicion),
        name:     r.Nombre_equipo,
        pts:      Number(r.Puntos),
        pj:       Number(r.Partidos_jugados),
        pg:       Number(r.Partidos_ganados),
        pe:       Number(r.Partidos_empatados),
        pp:       Number(r.Partidos_perdidos),
        gf:       Number(r.Goles_favor),
        gc:       Number(r.Goles_contra),
        gd:       Number(r.Goles_favor) - Number(r.Goles_contra),
      }))
      .sort((a, b) => a.position - b.position);
  } else {
    // La API aún no tiene datos: clasificación provisional con equipos en orden alfabético, todo a 0
    const teams = new Set();
    for (const matches of Object.values(matchData)) {
      for (const m of matches) {
        if (m.homeTeam && m.homeTeam !== '** DESCANSA **') teams.add(m.homeTeam);
        if (m.awayTeam && m.awayTeam !== '** DESCANSA **') teams.add(m.awayTeam);
      }
    }
    standings = [...teams].sort((a, b) => a.localeCompare(b, 'es')).map((name, i) => ({
      position: i + 1, name, pts: 0, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, gd: 0,
    }));
  }

  await db.collection('standings_cache_municipal').doc(SEASON).set({
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    standings,
  });
  console.log(`Clasificación: ${standings.length} equipos${records.length === 0 ? ' (provisional, ordenada alfabéticamente)' : ''}`);
}

async function main() {
  const matchData = await syncMatches();
  await syncStandings(matchData);
  console.log('\nSync Liga Municipal completado.');
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
