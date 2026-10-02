const admin = require('firebase-admin');
const sa = require('./serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

async function main() {
  // Borrar el doc auto-generado
  await db.collection('minigames').doc('zVnxNvRVPoNQChy18uow').delete();
  console.log('Borrado doc auto-generado');

  const startDate = new Date('2026-10-02T00:00:00+02:00');
  const endDate   = new Date('2026-10-10T23:59:00+02:00');

  await db.collection('minigames').doc('simon-j12-j13').set({
    type:           'sequence',
    title:          'Simon de Escudos',
    afterMatchday:  12,
    startDate:      admin.firestore.Timestamp.fromDate(startDate),
    endDate:        admin.firestore.Timestamp.fromDate(endDate),
    timeLimit:      60,
    pointsComplete: 10,
    pointsStarted:  5,
    weekLabel:      'JORNADA 12-13',
  });

  console.log('Creado minigame con id: simon-j12-j13');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
