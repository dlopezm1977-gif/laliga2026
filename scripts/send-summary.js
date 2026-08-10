// Envía resumen de jornada personalizado por email a cada participante
// Uso: node send-summary.js [--jornada N] [--test]
//      node send-summary.js --recordatorio [--fecha "15 de agosto"] [--test]
// Requiere en scripts/.env:
//   GMAIL_USER=quiniela.laliga2627@gmail.com
//   GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
//   ADMIN_EMAIL=dlopezm1977@gmail.com   (recibe además el bloque para WhatsApp y BCC de todos los mails)

const fs         = require('fs');
const path       = require('path');
const admin      = require('firebase-admin');
const nodemailer = require('nodemailer');

// ── Cargar .env ────────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...rest] = line.split('=');
    if (k && rest.length && !process.env[k.trim()]) {
      process.env[k.trim()] = rest.join('=').trim();
    }
  });
}

const GMAIL_USER         = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const ADMIN_EMAIL        = process.env.ADMIN_EMAIL || '';

if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
  console.error('❌  Falta GMAIL_USER o GMAIL_APP_PASSWORD en scripts/.env');
  process.exit(1);
}

// ── Argumentos ─────────────────────────────────────────────────────────────
const jornadaArg     = process.argv.indexOf('--jornada');
const jornadaForzada = jornadaArg !== -1 ? Number(process.argv[jornadaArg + 1]) : null;
const TEST_MODE      = process.argv.includes('--test');        // solo envía al ADMIN_EMAIL
const MODO_RECORDATORIO = process.argv.includes('--recordatorio');
const fechaArg       = process.argv.indexOf('--fecha');
const FECHA_LIMITE   = fechaArg !== -1 ? process.argv[fechaArg + 1] : '15 de agosto';

// ── Firebase Admin ─────────────────────────────────────────────────────────
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ── Constantes ─────────────────────────────────────────────────────────────
const MEDALS = ['🥇', '🥈', '🥉'];

// Devuelve la ruta absoluta del fichero de imagen (png/jpg/jpeg/svg) o ''
function findImagePath(basename) {
  for (const ext of ['png', 'jpg', 'jpeg', 'svg']) {
    const filePath = path.join(__dirname, 'email-images', `${basename}.${ext}`);
    if (fs.existsSync(filePath)) return filePath;
  }
  return '';
}

const TREND_IMAGES = {
  lider:   findImagePath('lider'),
  up:      findImagePath('sube'),
  same:    findImagePath('mantiene'),
  down:    findImagePath('baja'),
  unknown: findImagePath('unknown'),
};

// ── Tendencia respecto a la jornada anterior ───────────────────────────────
function calcularTendencia(usuario, ranking, jornada) {
  if (jornada <= 1) return 'unknown';

  const jornadaKey = String(jornada);
  const rankingPrevio = ranking
    .map(u => ({
      uid:         u.uid,
      totalPoints: u.totalPoints - (u.byMatchday[jornadaKey]?.points || 0),
    }))
    .sort((a, b) => b.totalPoints - a.totalPoints);

  const posActual = ranking.findIndex(u => u.uid === usuario.uid) + 1;
  const posPrevia = rankingPrevio.findIndex(u => u.uid === usuario.uid) + 1;

  if (posActual < posPrevia) return 'up';
  if (posActual > posPrevia) return 'down';
  return 'same';
}

// ── Mensaje motivacional según posición (10 grupos) ───────────────────────
function mensajePersonal(pos, total) {
  if (pos === 1)         return '👑 ¡Eres el líder! La porra es tuya, defiéndela jornada a jornada.';
  if (pos === 2)         return '🔥 ¡A un solo puesto del liderato! Presiona fuerte, el primero ya te siente.';
  if (pos === 3)         return '💪 ¡En el podio! Aguanta la posición y prepara el asalto a los de arriba.';
  if (pos === 4)         return '🎯 ¡Cuarto! A un paso del podio, una buena jornada y estás dentro.';
  if (pos === total)     return '🌱 ¡A por todas desde abajo! El campeón de la próxima jornada podrías ser tú.';
  if (pos === total - 1) return '😤 ¡Penúltimo, pero queda mucha liga! Una racha de buenos resultados y cambias el panorama.';
  // Grupos por percentil normalizado (evita solapar con los extremos ya capturados)
  const pct = (pos - 1) / (total - 1);
  if (pct <= 0.35)       return '⚽ ¡Bien colocado en la parte alta! Sigue acumulando y la zona noble se acerca.';
  if (pct <= 0.50)       return '📈 ¡Justo por encima de la mitad! Un empujón y entras en zona noble.';
  if (pct <= 0.65)       return '📉 ¡Justo por debajo de la mitad! Estás cerca, una jornada te puede cambiar la vida.';
  /* zona baja */        return '😬 ¡En la zona baja, pero no todo está perdido! Queda temporada, mantén la cabeza.';
}

// ── Texto WhatsApp (solo para el admin) ───────────────────────────────────
function generarTextoWhatsApp(jornada, topJornada, top3General) {
  const lines = [
    `🏆 *QUINIELA LALIGA 26/27 · JORNADA ${jornada}* 🏆`,
    '',
    '📅 *TOP 3 DE LA JORNADA*',
    ...(topJornada.length
      ? topJornada.map((u, i) => `${MEDALS[i]} ${u.username} → ${u.points} pts`)
      : ['_(sin datos aún)_']),
    '',
    '📊 *CLASIFICACIÓN GENERAL*',
    ...top3General.map((u, i) => `${MEDALS[i]} ${u.username} → ${u.totalPoints} pts _(${u.matchdaysPlayed}J)_`),
    '',
    '💬 ¡La quiniela está más viva que nunca! ¿Quién da el golpe la próxima jornada? 🚀',
  ];
  return lines.join('\n');
}

// ── HTML personalizado por usuario ─────────────────────────────────────────
function generarHTML({ jornada, topJornada, top3General, ranking, usuario, esAdmin, textoWA, tendencia }) {
  const pos   = ranking.findIndex(u => u.uid === usuario.uid) + 1;
  const total = ranking.length;
  const msgPersonal = mensajePersonal(pos, total);

  const rivalArriba      = pos > 1 ? ranking[pos - 2] : null;
  const puntosParaSubir  = rivalArriba ? rivalArriba.totalPoints - usuario.totalPoints : 0;

  const trendKey    = pos === 1 ? 'lider' : tendencia;
  const trendImgPath = TREND_IMAGES[trendKey] || '';
  const trendLabel   = { lider: 'Líder 👑', up: 'Sube 📈', same: 'Mantiene ➡️', down: 'Baja 📉', unknown: '' }[trendKey] || '';
  const bloqueImagen = trendImgPath ? `
    <div style="text-align:center;padding:12px 32px 0">
      <img src="cid:trend" alt="${trendLabel}" style="max-width:100%;height:auto;border-radius:8px" />
    </div>` : '';

  // Filas top 3 jornada
  const filaJornada = topJornada.length
    ? topJornada.map((u, i) => `
      <tr>
        <td style="font-size:1.3rem;width:36px;padding:6px 0">${MEDALS[i]}</td>
        <td style="font-weight:600;color:#0f172a;padding:6px 0">${escHtml(u.username)}</td>
        <td style="text-align:right;font-weight:700;color:#ee3524;padding:6px 0">${u.points} pts</td>
      </tr>`).join('')
    : '<tr><td colspan="3" style="color:#94a3b8;font-style:italic;padding:6px 0">Sin datos aún</td></tr>';

  // Filas clasificación general (top 3 + fila del usuario si no está en top 3)
  const mostrar = [...top3General];
  const estaEnTop3 = pos <= 3;
  if (!estaEnTop3) mostrar.push(usuario);

  const filaGeneral = mostrar.map((u, i) => {
    const esYo   = u.uid === usuario.uid;
    const posReal = ranking.findIndex(r => r.uid === u.uid) + 1;
    const medal  = posReal <= 3 ? MEDALS[posReal - 1] : `${posReal}º`;
    const bg     = esYo ? 'background:#fff7ed;' : '';
    const fw     = esYo ? 'font-weight:700;' : 'font-weight:600;';
    const sep    = (!estaEnTop3 && i === 2)
      ? '<tr><td colspan="3" style="text-align:center;color:#94a3b8;font-size:.8rem;padding:4px 0">· · ·</td></tr>'
      : '';
    return `${sep}
      <tr style="${bg}border-radius:6px">
        <td style="font-size:1.1rem;width:36px;padding:6px 4px">${medal}</td>
        <td style="${fw}color:#0f172a;padding:6px 4px">${escHtml(u.username)}${esYo ? ' <span style="color:#ee3524;font-size:.75rem">(tú)</span>' : ''}</td>
        <td style="text-align:right;padding:6px 4px">
          <span style="font-weight:700;color:#ee3524">${u.totalPoints} pts</span>
          <span style="color:#94a3b8;font-size:.78rem;margin-left:5px">${u.matchdaysPlayed}J</span>
        </td>
      </tr>`;
  }).join('');

  // Bloque WhatsApp solo para el admin
  const bloqueWA = esAdmin && textoWA ? `
    <div style="background:#f1f5f9;border-top:1px solid #e2e8f0;padding:24px 32px">
      <p style="margin:0 0 10px;font-size:.78rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em">
        📋 Copia este texto para WhatsApp
      </p>
      <pre style="margin:0;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;font-family:'Courier New',monospace;font-size:.78rem;color:#334155;white-space:pre-wrap;word-break:break-word">${escHtml(textoWA)}</pre>
    </div>` : '';

  return { html: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">

    <!-- Header -->
    <div style="background:#ee3524;padding:24px 32px;text-align:center">
      <div style="font-size:1.8rem">🏆</div>
      <h1 style="margin:6px 0 3px;color:#fff;font-size:1.2rem;font-weight:700;letter-spacing:.04em">
        QUINIELA LALIGA 26/27
      </h1>
      <p style="margin:0;color:rgba(255,255,255,.85);font-size:.88rem">Resumen Jornada ${jornada}</p>
    </div>

    <!-- Saludo -->
    <div style="padding:20px 32px 0">
      <p style="margin:0;color:#475569;font-size:.95rem">Hola <strong>${escHtml(usuario.username)}</strong>, aquí tienes el resumen de la jornada 👇</p>
    </div>

    ${bloqueImagen}

    <!-- Cuerpo -->
    <div style="padding:16px 32px 28px">

      <h2 style="margin:16px 0 10px;color:#1e293b;font-size:.9rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em">
        📅 Top 3 de la Jornada
      </h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        ${filaJornada}
      </table>

      <h2 style="margin:0 0 10px;color:#1e293b;font-size:.9rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em">
        📊 Clasificación General
      </h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        ${filaGeneral}
      </table>

      <!-- Tu posición -->
      <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:14px 16px;margin-bottom:12px">
        <p style="margin:0 0 4px;font-size:.78rem;font-weight:700;color:#9a3412;text-transform:uppercase;letter-spacing:.05em">Tu posición</p>
        <p style="margin:0;font-size:1.5rem;font-weight:700;color:#ea580c">${pos}º de ${total}</p>
      </div>

      ${rivalArriba ? `
      <!-- Rival por encima -->
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;margin-bottom:12px;display:flex;align-items:center;gap:10px">
        <div style="font-size:1.2rem">🎯</div>
        <div>
          <p style="margin:0 0 2px;font-size:.78rem;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:.05em">Para subir un puesto</p>
          ${puntosParaSubir === 0
            ? `<p style="margin:0;font-size:.93rem;color:#15803d">¡Empate técnico con <strong>${escHtml(rivalArriba.username)}</strong>! El desempate lo decide quién juega mejor la próxima jornada.</p>`
            : `<p style="margin:0;font-size:.93rem;color:#15803d">Te faltan <strong>${puntosParaSubir} pts</strong> para superar a <strong>${escHtml(rivalArriba.username)}</strong></p>`
          }
        </div>
      </div>` : ''}

      <!-- Mensaje personal -->
      <div style="background:#f8fafc;border-left:3px solid #ee3524;padding:14px 16px;border-radius:0 8px 8px 0;color:#334155;font-size:.93rem">
        ${escHtml(msgPersonal)}
      </div>
    </div>

    ${bloqueWA}

    <!-- Footer -->
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:12px 32px;text-align:center">
      <p style="margin:0;color:#94a3b8;font-size:.72rem">LaLiga Quiniela 26/27 · generado automáticamente</p>
    </div>

  </div>
</body>
</html>`, trendImgPath };
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── HTML recordatorio predicciones ────────────────────────────────────────
function generarHTMLRecordatorio(usuario, fechaLimite) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">

    <!-- Header -->
    <div style="background:#ee3524;padding:24px 32px;text-align:center">
      <div style="font-size:1.8rem">⏰</div>
      <h1 style="margin:6px 0 3px;color:#fff;font-size:1.2rem;font-weight:700;letter-spacing:.04em">
        QUINIELA LALIGA 26/27
      </h1>
      <p style="margin:0;color:rgba(255,255,255,.85);font-size:.88rem">Recordatorio de predicciones</p>
    </div>

    <!-- Cuerpo -->
    <div style="padding:28px 32px">
      <p style="margin:0 0 16px;color:#475569;font-size:.95rem">
        Hola <strong>${escHtml(usuario.username)}</strong> 👋
      </p>
      <p style="margin:0 0 16px;color:#334155;font-size:.95rem;line-height:1.6">
        Te escribimos para recordarte que tienes hasta el
        <strong style="color:#ee3524">${escHtml(fechaLimite)}</strong>
        para rellenar o completar tus predicciones de la temporada.
      </p>
      <p style="margin:0 0 24px;color:#334155;font-size:.95rem;line-height:1.6">
        Las predicciones que no estén registradas antes de esa fecha
        <strong>no puntúan</strong>, así que no te la juegues y entra ahora a completarlas. 🏆
      </p>

      <!-- CTA -->
      <div style="text-align:center;margin-bottom:24px">
        <a href="https://dlopezm1977-gif.github.io/laliga2026/"
           style="display:inline-block;background:#ee3524;color:#fff;text-decoration:none;font-weight:700;font-size:.95rem;padding:14px 32px;border-radius:8px;letter-spacing:.03em">
          Ir a la Quiniela →
        </a>
      </div>

      <div style="background:#fff7ed;border-left:3px solid #ee3524;padding:14px 16px;border-radius:0 8px 8px 0;color:#334155;font-size:.88rem;line-height:1.5">
        ⚽ Recuerda que cada predicción correcta suma puntos. ¡No dejes que se te escapen jornadas enteras por no haberlas rellenado!
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:12px 32px;text-align:center">
      <p style="margin:0;color:#94a3b8;font-size:.72rem">LaLiga Quiniela 26/27 · generado automáticamente</p>
    </div>

  </div>
</body>
</html>`;
}

// ── Envío recordatorio ─────────────────────────────────────────────────────
async function enviarRecordatorios(usuarios, fechaLimite) {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });

  for (const usuario of usuarios) {
    if (!usuario.email) continue;
    const esAdmin = usuario.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
    if (TEST_MODE && !esAdmin) { console.log(`  ⏭️   ${usuario.email} omitido (--test)`); continue; }

    const html = generarHTMLRecordatorio(usuario, fechaLimite);
    const bcc  = ADMIN_EMAIL && !esAdmin ? ADMIN_EMAIL : undefined;

    const info = await transporter.sendMail({
      from:    `"Quiniela LaLiga" <${GMAIL_USER}>`,
      to:      usuario.email,
      ...(bcc ? { bcc } : {}),
      subject: `⏰ Recuerda rellenar tus predicciones antes del ${fechaLimite} · Quiniela LaLiga 26/27`,
      text:    `Hola ${usuario.username}, tienes hasta el ${fechaLimite} para completar tus predicciones en https://dlopezm1977-gif.github.io/laliga2026/`,
      html,
    });
    console.log(`  ✉️   ${usuario.email} → ${info.messageId}${bcc ? ` (bcc: ${bcc})` : ''}`);
  }
}

// ── Envío individual (resumen jornada) ────────────────────────────────────
async function enviarEmails(jornada, topJornada, top3General, ranking, textoWA) {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });

  for (const usuario of ranking) {
    if (!usuario.email) continue;
    const esAdmin   = usuario.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
    if (TEST_MODE && !esAdmin) { console.log(`  ⏭️   ${usuario.email} omitido (--test)`); continue; }
    const tendencia = calcularTendencia(usuario, ranking, jornada);
    const { html, trendImgPath } = generarHTML({ jornada, topJornada, top3General, ranking, usuario, esAdmin, textoWA, tendencia });
    const pos  = ranking.findIndex(u => u.uid === usuario.uid) + 1;
    const bcc  = ADMIN_EMAIL && !esAdmin ? ADMIN_EMAIL : undefined;

    const attachments = trendImgPath ? [{
      filename: path.basename(trendImgPath),
      path:     trendImgPath,
      cid:      'trend',
    }] : [];

    const info = await transporter.sendMail({
      from:    `"Quiniela LaLiga" <${GMAIL_USER}>`,
      to:      usuario.email,
      ...(bcc ? { bcc } : {}),
      subject: `🏆 Jornada ${jornada} · Quiniela LaLiga 26/27 — Vas ${pos}º`,
      text:    `Hola ${usuario.username}, vas ${pos}º de ${ranking.length}. ${textoWA}`,
      html,
      attachments,
    });
    console.log(`  ✉️   ${usuario.email} (${pos}º) → ${info.messageId}${bcc ? ` (bcc: ${bcc})` : ''}`);
  }
}

// ── Lógica principal ───────────────────────────────────────────────────────
async function main() {
  const usersSnap = await db.collection('users').get();
  const usuarios  = [];
  usersSnap.forEach(d => {
    const user = d.data();
    if (!user.email) return;
    usuarios.push({ uid: d.id, username: user.username || 'Anónimo', email: user.email });
  });

  if (!usuarios.length) {
    console.error('❌  No hay usuarios con email en la base de datos');
    process.exit(1);
  }
  console.log(`👥  Participantes: ${usuarios.map(u => u.username).join(', ')}`);

  // ── Modo recordatorio ──────────────────────────────────────────────────
  if (MODO_RECORDATORIO) {
    console.log(`⏰  Modo recordatorio · fecha límite: ${FECHA_LIMITE}`);
    console.log(`📧  Enviando recordatorios...`);
    await enviarRecordatorios(usuarios, FECHA_LIMITE);
    console.log(`✅  Listo.`);
    return;
  }

  // ── Modo resumen de jornada ────────────────────────────────────────────
  const scoresSnap = await db.collection('scores').orderBy('totalPoints', 'desc').get();
  const scoresMap  = {};
  scoresSnap.forEach(d => { scoresMap[d.id] = d.data(); });

  const ranking = usuarios.map(u => {
    const score = scoresMap[u.uid] || {};
    return {
      ...u,
      totalPoints:     score.totalPoints     || 0,
      matchdaysPlayed: score.matchdaysPlayed || 0,
      byMatchday:      score.byMatchday      || {},
    };
  });
  ranking.sort((a, b) => b.totalPoints - a.totalPoints);

  // Detectar jornada
  let jornada = jornadaForzada;
  if (!jornada) {
    const jornadasConDatos = new Set();
    ranking.forEach(u => Object.keys(u.byMatchday).forEach(j => jornadasConDatos.add(Number(j))));
    jornada = jornadasConDatos.size ? Math.max(...jornadasConDatos) : null;
  }
  if (!jornada) {
    console.error('❌  No se encontraron jornadas con datos. Usa --jornada N');
    process.exit(1);
  }
  console.log(`📅  Jornada: ${jornada}`);

  const jornadaKey = String(jornada);
  const topJornada = ranking
    .map(u => ({ ...u, points: u.byMatchday[jornadaKey]?.points || 0 }))
    .filter(u => u.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 3);

  if (!topJornada.length) console.warn(`⚠️   Nadie tiene puntos en jornada ${jornada}.`);

  const top3General = ranking.slice(0, 3);
  const textoWA     = generarTextoWhatsApp(jornada, topJornada, top3General);

  console.log(`📧  Enviando emails individuales...`);
  await enviarEmails(jornada, topJornada, top3General, ranking, textoWA);
  console.log(`✅  Listo.`);
}

main().catch(err => { console.error('❌ ', err.message); process.exit(1); });
