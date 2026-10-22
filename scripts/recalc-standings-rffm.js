// Recalcula la clasificación de temporadas archivadas desde los partidos ya guardados en Firestore.
// Uso: node scripts/recalc-standings-rffm.js [2122 2223 ...]   (sin argumentos: todas las de meta.seasons salvo la actual)
const admin = require('firebase-admin');
const { computeStandings } = require('./standings-rffm');

admin.initializeApp({ credential: admin.credential.cert(require('./serviceAccountKey.json')) });
const db = admin.firestore();

async function main() {
  const meta = (await db.collection('matches_cache_rffm').doc('meta').get()).data() ?? {};
  const seasons = process.argv.length > 2
    ? process.argv.slice(2)
    : (meta.seasons ?? []).filter(s => s !== (meta.currentSeason ?? '2627'));

  for (const season of seasons) {
    const snaps = await db.collection('matches_cache_rffm').listDocuments();
    const prefix = `${season}_`;
    const rounds = {};
    await Promise.all(snaps.filter(d => d.id.startsWith(prefix)).map(async d => {
      rounds[d.id.slice(prefix.length)] = (await d.get()).data().matches ?? [];
    }));
    if (!Object.keys(rounds).length) { console.warn(`${season}: sin partidos`); continue; }

    const standings = computeStandings(rounds);
    await db.collection('standings_cache_rffm').doc(season).set({
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      standings,
    });
    console.log(`${season}: ${standings.length} equipos · 1º ${standings[0].name} (${standings[0].pts}) · 2º ${standings[1].name} (${standings[1].pts})`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
