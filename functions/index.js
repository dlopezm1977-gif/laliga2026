const { onSchedule }  = require('firebase-functions/v2/scheduler');
const { onRequest }   = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin      = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();
const db = admin.firestore();

const FD_TOKEN          = defineSecret('FD_TOKEN');
const GMAIL_USER        = defineSecret('GMAIL_USER');
const GMAIL_APP_PASSWORD = defineSecret('GMAIL_APP_PASSWORD');
const ADMIN_EMAIL_S     = defineSecret('ADMIN_EMAIL');
const CRON_SECRET       = defineSecret('CRON_SECRET');

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

// ── sendRecordatorio — HTTP trigger para cron-job.org ─────────────────────
exports.sendRecordatorio = onRequest(
  { secrets: [GMAIL_USER, GMAIL_APP_PASSWORD, ADMIN_EMAIL_S, CRON_SECRET] },
  async (req, res) => {
    // Validar secret
    const secret = req.headers['x-cron-secret'] || req.query.secret;
    if (secret !== CRON_SECRET.value()) {
      res.status(401).send('Unauthorized');
      return;
    }

    const fechaLimite = req.query.fecha || '15 de agosto';
    const gmailUser   = GMAIL_USER.value();
    const adminEmail  = ADMIN_EMAIL_S.value();

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 587, secure: false,
      auth: { user: gmailUser, pass: GMAIL_APP_PASSWORD.value() },
    });

    const usersSnap = await db.collection('users').get();
    const enviados  = [];

    for (const doc of usersSnap.docs) {
      const user = doc.data();
      if (!user.email) continue;

      const esAdmin = user.email.toLowerCase() === adminEmail.toLowerCase();
      const bcc     = adminEmail && !esAdmin ? adminEmail : undefined;
      const nombre  = user.username || 'Anónimo';

      const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Helvetica Neue',Arial,sans-serif">
<div style="max-width:520px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
  <div style="background:#ee3524;padding:24px 32px;text-align:center">
    <div style="font-size:1.8rem">⏰</div>
    <h1 style="margin:6px 0 3px;color:#fff;font-size:1.2rem;font-weight:700">QUINIELA LALIGA 26/27</h1>
    <p style="margin:0;color:rgba(255,255,255,.85);font-size:.88rem">Recordatorio de predicciones</p>
  </div>
  <div style="padding:28px 32px">
    <p style="margin:0 0 16px;color:#475569;font-size:.95rem">Hola <strong>${nombre}</strong> 👋</p>
    <p style="margin:0 0 16px;color:#334155;font-size:.95rem;line-height:1.6">
      Te escribimos para recordarte que tienes hasta el
      <strong style="color:#ee3524">${fechaLimite}</strong>
      para rellenar o completar tus predicciones de la temporada.
    </p>
    <p style="margin:0 0 24px;color:#334155;font-size:.95rem;line-height:1.6">
      Las predicciones que no estén registradas antes de esa fecha
      <strong>no puntúan</strong>, así que no te la juegues y entra ahora a completarlas. 🏆
    </p>
    <div style="text-align:center;margin-bottom:24px">
      <a href="https://laliga2026.web.app"
         style="display:inline-block;background:#ee3524;color:#fff;text-decoration:none;font-weight:700;font-size:.95rem;padding:14px 32px;border-radius:8px">
        Ir a la Quiniela →
      </a>
    </div>
    <div style="background:#fff7ed;border-left:3px solid #ee3524;padding:14px 16px;border-radius:0 8px 8px 0;color:#334155;font-size:.88rem;line-height:1.5">
      ⚽ Recuerda que cada predicción correcta suma puntos. ¡No dejes que se te escapen jornadas enteras!
    </div>
  </div>
  <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:12px 32px;text-align:center">
    <p style="margin:0;color:#94a3b8;font-size:.72rem">LaLiga Quiniela 26/27 · generado automáticamente</p>
  </div>
</div>
</body></html>`;

      await transporter.sendMail({
        from:    `"Quiniela LaLiga" <${gmailUser}>`,
        to:      user.email,
        ...(bcc ? { bcc } : {}),
        subject: `⏰ Recuerda rellenar tus predicciones antes del ${fechaLimite} · Quiniela LaLiga 26/27`,
        text:    `Hola ${nombre}, tienes hasta el ${fechaLimite} para completar tus predicciones en https://laliga2026.web.app`,
        html,
      });
      enviados.push(user.email);
      console.log(`✉️  ${user.email} → ok${bcc ? ` (bcc: ${bcc})` : ''}`);
    }

    res.json({ ok: true, enviados: enviados.length, destinatarios: enviados });
  }
);

