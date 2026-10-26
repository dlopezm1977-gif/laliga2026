/**
 * Unifica los enlaces de vídeo de Juvenil y Municipal en la colección match_videos:
 *   - Juvenil:   match_videos_rffm/{codacta}              → match_videos/rffm_{codacta}
 *   - Municipal: matches_cache_municipal/{temp}_{jornada}  → match_videos/municipal_{temp}_{jornada}_{local}_{visitante}
 *                (campo `video` de cada gol del detalle)
 * No borra nada de origen y no pisa documentos que ya existan en match_videos (se puede relanzar).
 * La clave de Municipal debe coincidir con municipalVideoKey() de src/lib/matchVideos.js.
 *
 *   cd functions
 *   GOOGLE_APPLICATION_CREDENTIALS=../service-account.json node ../scripts/migrate-match-videos.js [--dry]
 */

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'laliga-quiniela' });
const db = admin.firestore();
const DRY = process.argv.includes('--dry');

const slug = s => String(s ?? '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');

async function put(key, videos) {
  const ref = db.collection('match_videos').doc(key);
  if ((await ref.get()).exists) { console.log(`  = ${key} ya existe, se omite`); return 0; }
  console.log(`  + ${key}: ${videos.length} vídeo(s)`);
  if (!DRY) await ref.set({ updatedAt: admin.firestore.FieldValue.serverTimestamp(), videos });
  return 1;
}

async function run() {
  let created = 0;

  console.log('Juvenil (match_videos_rffm)…');
  const rffm = await db.collection('match_videos_rffm').get();
  for (const d of rffm.docs) {
    const videos = (d.data().videos ?? [])
      .filter(v => v.url)
      .map(v => ({ tipo: 'gol', label: v.label ?? '', url: v.url }));
    if (videos.length) created += await put(`rffm_${d.id}`, videos);
  }

  console.log('Municipal (video por gol)…');
  const muni = await db.collection('matches_cache_municipal').get();
  for (const d of muni.docs) {
    const m = d.id.match(/^(\d+)_(\d+)$/);
    if (!m) continue;
    const [, season, round] = m;
    for (const match of d.data().matches ?? []) {
      const videos = (match.detail?.goals ?? [])
        .filter(g => g.video)
        .map(g => ({ tipo: 'gol', label: `Gol de ${g.nombre}`, url: g.video }));
      if (!videos.length) continue;
      created += await put(`municipal_${season}_${round}_${slug(match.homeTeam)}_${slug(match.awayTeam)}`, videos);
    }
  }

  console.log(`\n${DRY ? '[dry-run] ' : ''}Documentos creados: ${created}`);
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
