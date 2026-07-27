/**
 * One-time script to create empty monthly_results documents for the season.
 * Run from the functions/ directory (where firebase-admin is installed):
 *
 *   cd functions
 *   GOOGLE_APPLICATION_CREDENTIALS=../service-account.json node ../scripts/init-monthly-results.js
 *
 * Download service-account.json from:
 *   Firebase Console → Project Settings → Service accounts → Generate new private key
 */

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'laliga-quiniela' });
const db = admin.firestore();

const MONTHS = [
  'agosto-2026', 'sep-2026', 'octubre-2026', 'noviembre-2026', 'diciembre-2026',
  'enero-2027',  'febrero-2027', 'marzo-2027', 'abril-2027', 'mayo-2027',
];

const EMPTY = { bestPlayer: null, bestCoach: null, bestU23: null };

async function run() {
  const batch = db.batch();
  for (const monthKey of MONTHS) {
    const ref = db.collection('monthly_results').doc(monthKey);
    // merge:true so we don't overwrite if already filled
    batch.set(ref, EMPTY, { merge: true });
    console.log(`Queued: ${monthKey}`);
  }
  await batch.commit();
  console.log('Done — 10 documents created in monthly_results.');
}

run().catch(console.error);
