/**
 * Crea/actualiza la configuración de ambientaciones estacionales (app_config/seasons).
 * Fechas en formato MM-DD, repetidas cada año. Si start > end cruza el cambio de año.
 * Para cambiar fechas o desactivar basta editar el documento en Firestore
 * (campos enabled / start / end, o forceActive: true para forzar una temporada).
 *
 *   cd functions
 *   GOOGLE_APPLICATION_CREDENTIALS=../service-account.json node ../scripts/init-seasons.js
 */

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'laliga-quiniela' });
const db = admin.firestore();

const SEASONS = [
  { id: 'halloween', enabled: true, start: '10-24', end: '11-02' },
  { id: 'navidad',   enabled: true, start: '12-01', end: '01-07' },
];

db.doc('app_config/seasons').set({ seasons: SEASONS })
  .then(() => { console.log('app_config/seasons actualizado'); process.exit(0); })
  .catch(e => { console.error(e); process.exit(1); });
