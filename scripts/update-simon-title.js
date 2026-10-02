const admin = require('firebase-admin');
const sa = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
admin.firestore().collection('minigames').doc('simon-j12-j13')
  .update({ title: 'Simon · Semana 12-13' })
  .then(() => { console.log('OK'); process.exit(0); })
  .catch(e => { console.error(e); process.exit(1); });
