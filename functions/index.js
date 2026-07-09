const { onSchedule }       = require('firebase-functions/v2/scheduler');
const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { defineSecret }      = require('firebase-functions/params');
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

// ── calculateScores — triggers on matches_cache update ────────────────────
exports.calculateScores = onDocumentUpdated(
  'matches_cache/{matchday}',
  async event => {
    const matchday  = event.params.matchday;
    const newData   = event.data.after.data();
    const prevData  = event.data.before.data();

    const newMatches  = newData?.matches  || [];
    const prevMatches = prevData?.matches || [];

    // Find matches that just became FINISHED
    const justFinished = newMatches.filter(nm => {
      if (nm.status !== 'FINISHED') return false;
      const prev = prevMatches.find(pm => pm.matchId === nm.matchId);
      return !prev || prev.status !== 'FINISHED';
    });

    if (justFinished.length === 0) return;

    // Build result map for finished matches
    const resultMap = {};
    for (const m of justFinished) {
      resultMap[m.matchId] = { home: m.homeScore, away: m.awayScore };
    }

    // Load all user predictions for this matchday
    const allMatchdaySnap = await db
      .collectionGroup('matchdays')
      .get();

    const matchdayDocs = allMatchdaySnap.docs.filter(
      d => d.id === String(matchday)
    );

    const batch = db.batch();

    for (const doc of matchdayDocs) {
      const uid = doc.ref.parent.parent.id;
      const { matches: preds = [] } = doc.data();

      let newExact = 0, newSign = 0;

      for (const pred of preds) {
        const real = resultMap[pred.matchId];
        if (!real) continue;

        const predSign = pred.homeScore > pred.awayScore ? 'H'
          : pred.awayScore > pred.homeScore ? 'A' : 'D';
        const realSign = real.home > real.away ? 'H'
          : real.away > real.home ? 'A' : 'D';

        if (pred.homeScore === real.home && pred.awayScore === real.away) {
          newExact++;
        } else if (predSign === realSign) {
          newSign++;
        }
      }

      const points = newExact * 3 + newSign;

      const scoreRef = db.collection('scores').doc(uid);
      batch.set(scoreRef, {
        totalPoints:    admin.firestore.FieldValue.increment(points),
        exactCount:     admin.firestore.FieldValue.increment(newExact),
        signCount:      admin.firestore.FieldValue.increment(newSign),
        matchdaysPlayed: admin.firestore.FieldValue.increment(points > 0 ? 1 : 0),
        [`byMatchday.${matchday}.points`]: admin.firestore.FieldValue.increment(points),
        [`byMatchday.${matchday}.exact`]:  admin.firestore.FieldValue.increment(newExact),
        [`byMatchday.${matchday}.sign`]:   admin.firestore.FieldValue.increment(newSign),
      }, { merge: true });
    }

    await batch.commit();
    console.log(`Scores updated for matchday ${matchday}: ${matchdayDocs.length} users`);
  }
);
