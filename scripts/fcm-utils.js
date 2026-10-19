// Gestión común de errores al enviar notificaciones FCM.
// Si el token ya no es válido (app desinstalada, datos borrados, token rotado)
// se elimina su documento de users/<uid>/fcmTokens para no seguir intentándolo.
const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

async function handleSendError(r, e) {
  const who = `${r.label ?? 'sin etiqueta'}, …${String(r.token).slice(-8)}`;
  if (INVALID_TOKEN_CODES.has(e.code) && r.ref) {
    try {
      await r.ref.delete();
      console.warn(`    ✗ Token caducado, eliminado (${who}): ${e.code}`);
      return;
    } catch (delErr) {
      console.warn(`    ✗ Token caducado, no se pudo eliminar (${who}): ${delErr.message}`);
      return;
    }
  }
  console.warn(`    ✗ Notificación fallida (${who}): ${e.code ?? ''} ${e.message}`);
}

module.exports = { handleSendError };
