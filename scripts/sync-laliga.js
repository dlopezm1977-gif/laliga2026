// Sync La Liga matches from football-data.org → Firestore matches_cache
// Run via GitHub Actions every 30 min
// Required env vars:
//   FOOTBALL_DATA_TOKEN  — football-data.org API token
//   FIREBASE_SERVICE_ACCOUNT — Firebase service account JSON (stringified)

const admin = require('firebase-admin');

const FD_TOKEN = process.env.FOOTBALL_DATA_TOKEN;
if (!FD_TOKEN) { console.error('Missing FOOTBALL_DATA_TOKEN'); process.exit(1); }

// GitHub Actions: env var; local: file
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

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
    // Only write if something changed (status or score)
    const changed = !prev || JSON.stringify(prev.matches) !== JSON.stringify(mdMatches);
    if (changed) {
      batch.set(db.collection('matches_cache').doc(md), {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        matches: mdMatches,
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

main().catch(err => { console.error(err); process.exit(1); });
