const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret }                      = require('firebase-functions/params');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

const FD_TOKEN = defineSecret('FD_TOKEN');

// ── Short team names ───────────────────────────────────────────────────────
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

// ── refreshMatchesCache — runs every 30 min ────────────────────────────────
exports.refreshMatchesCache = onSchedule(
  { schedule: 'every 30 minutes', secrets: [FD_TOKEN] },
  async () => {
    const token = FD_TOKEN.value();
    const res = await fetch(
      'https://api.football-data.org/v4/competitions/PD/matches?season=2026',
      { headers: { 'X-Auth-Token': token } }
    );
    if (!res.ok) {
      console.error('football-data API error', res.status);
      return;
    }
    const { matches } = await res.json();
    const byMatchday = {};
    for (const m of (matches || [])) {
      const md = m.matchday;
      if (!md) continue;
      if (!byMatchday[md]) byMatchday[md] = [];
      byMatchday[md].push({
        matchId:   m.id,
        homeTeam:  short(m.homeTeam.name),
        awayTeam:  short(m.awayTeam.name),
        homeScore: m.score?.fullTime?.home ?? null,
        awayScore: m.score?.fullTime?.away ?? null,
        status:    m.status,
        utcDate:   m.utcDate,
      });
    }

    const batch = db.batch();
    for (const [md, mdMatches] of Object.entries(byMatchday)) {
      batch.set(db.collection('matches_cache').doc(String(md)), {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        matches: mdMatches,
      });
    }
    await batch.commit();
    console.log(`Refreshed ${Object.keys(byMatchday).length} matchdays`);
  }
);

