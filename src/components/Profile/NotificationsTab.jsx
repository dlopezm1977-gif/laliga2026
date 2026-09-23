import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  isNotifSupported, requestAndSaveToken,
  removeDeviceToken, toggleDeviceEnabled, getUserTokens,
} from '../../lib/notifications';

const DEFAULT_PREFS = {
  goals:    { primera: 'disabled', segunda: 'disabled' },
  matchEnd: { primera: 'disabled', segunda: 'disabled', rffm: 'disabled' },
  predReminder: false,
  newGame:      false,
};

function timeAgo(ts) {
  if (!ts?.toMillis) return '';
  const diff = Date.now() - ts.toMillis();
  const m = Math.floor(diff / 60000);
  if (m < 2)   return 'hace un momento';
  if (m < 60)  return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

function ScopeSelector({ value, onChange }) {
  const opts = [
    { v: 'disabled', label: 'No' },
    { v: 'favorite', label: 'Solo favorito' },
    { v: 'all',      label: 'Todos' },
  ];
  return (
    <div className="notif-scope-group">
      {opts.map(o => (
        <button
          key={o.v}
          className={`notif-scope-btn${value === o.v ? ' active' : ''}`}
          onClick={() => onChange(o.v)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ToggleSwitch({ value, onChange }) {
  return (
    <button
      className={`notif-toggle-switch${value ? ' on' : ''}`}
      onClick={() => onChange(!value)}
      aria-pressed={value}
    >
      <span className="notif-toggle-knob" />
    </button>
  );
}

function LeagueRow({ label, value, onChange }) {
  return (
    <div className="notif-league-row">
      <span className="notif-league-label">{label}</span>
      <ScopeSelector value={value} onChange={onChange} />
    </div>
  );
}

export default function NotificationsTab() {
  const { user, profile, updateProfile } = useAuth();
  const [tokens, setTokens]   = useState([]);
  const [prefs, setPrefs]     = useState(() => ({ ...DEFAULT_PREFS, ...profile?.notifPrefs }));
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState('');

  const supported   = isNotifSupported();
  const permission  = supported ? Notification.permission : 'denied';
  const hasEnabled  = tokens.some(t => t.enabled);

  useEffect(() => {
    if (!user) return;
    getUserTokens(user.uid).then(t => { setTokens(t); setLoading(false); });
  }, [user]);

  async function handleActivate() {
    setActivating(true); setError('');
    try {
      const result = await requestAndSaveToken(user.uid);
      if (result) setTokens(prev => prev.find(t => t.id === result.id) ? prev : [result, ...prev]);
    } catch {
      setError('No se pudo activar. Comprueba los permisos del navegador.');
    } finally {
      setActivating(false);
    }
  }

  async function handleRemove(id) {
    await removeDeviceToken(user.uid, id);
    setTokens(prev => prev.filter(t => t.id !== id));
  }

  async function handleToggleDevice(id, enabled) {
    await toggleDeviceEnabled(user.uid, id, enabled);
    setTokens(prev => prev.map(t => t.id === id ? { ...t, enabled } : t));
  }

  function setPref(path, value) {
    setPrefs(prev => {
      const parts = path.split('.');
      if (parts.length === 1) return { ...prev, [parts[0]]: value };
      return { ...prev, [parts[0]]: { ...prev[parts[0]], [parts[1]]: value } };
    });
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try { await updateProfile({ notifPrefs: prefs }); setSaved(true); }
    finally { setSaving(false); }
  }

  return (
    <div className="notif-tab">

      {/* ── Dispositivos ── */}
      <div className="notif-section">
        <div className="notif-section-title">Mis dispositivos</div>
        {loading ? (
          <div className="notif-hint">Cargando…</div>
        ) : (
          <>
            {tokens.length === 0 && (
              <div className="notif-hint">Ningún dispositivo registrado todavía.</div>
            )}
            {tokens.map(t => (
              <div key={t.id} className="notif-device">
                <div className="notif-device-info">
                  <span className="notif-device-label">{t.label}</span>
                  <span className="notif-device-time">{timeAgo(t.lastActive)}</span>
                </div>
                <div className="notif-device-actions">
                  <button
                    className={`notif-bell-btn${t.enabled ? ' on' : ''}`}
                    onClick={() => handleToggleDevice(t.id, !t.enabled)}
                    title={t.enabled ? 'Silenciar' : 'Activar'}
                  >
                    {t.enabled ? '🔔' : '🔕'}
                  </button>
                  <button className="notif-remove-btn" onClick={() => handleRemove(t.id)} title="Quitar dispositivo">✕</button>
                </div>
              </div>
            ))}

            {supported && permission !== 'denied' && (
              <button className="notif-activate-btn" onClick={handleActivate} disabled={activating}>
                {activating ? 'Activando…' : '+ Activar este dispositivo'}
              </button>
            )}
            {supported && permission === 'denied' && (
              <div className="notif-hint notif-hint--warn">
                Notificaciones bloqueadas en este navegador. Actívalas desde los ajustes del navegador.
              </div>
            )}
            {!supported && (
              <div className="notif-hint">Tu navegador no admite notificaciones push.</div>
            )}
            {error && <div className="notif-hint notif-hint--error">{error}</div>}
          </>
        )}
      </div>

      {/* ── Preferencias (solo si hay al menos un dispositivo activo) ── */}
      {hasEnabled && (
        <>
          {/* Goles en vivo */}
          <div className="notif-section">
            <div className="notif-section-title">🔴 Goles en vivo</div>
            <LeagueRow label="LaLiga"     value={prefs.goals?.primera ?? 'disabled'} onChange={v => setPref('goals.primera', v)} />
            <LeagueRow label="2ª División" value={prefs.goals?.segunda ?? 'disabled'} onChange={v => setPref('goals.segunda', v)} />
          </div>

          {/* Fin de partido */}
          <div className="notif-section">
            <div className="notif-section-title">✅ Fin de partido</div>
            <LeagueRow label="LaLiga"     value={prefs.matchEnd?.primera ?? 'disabled'} onChange={v => setPref('matchEnd.primera', v)} />
            <LeagueRow label="2ª División" value={prefs.matchEnd?.segunda ?? 'disabled'} onChange={v => setPref('matchEnd.segunda', v)} />
            <LeagueRow label="RFFM"       value={prefs.matchEnd?.rffm    ?? 'disabled'} onChange={v => setPref('matchEnd.rffm', v)} />
          </div>

          {/* Simples */}
          <div className="notif-section">
            <div className="notif-toggle-row">
              <div>
                <div className="notif-simple-title">⏰ Recordatorio de predicciones</div>
                <div className="notif-simple-desc">24h antes del cierre de cada jornada</div>
              </div>
              <ToggleSwitch value={prefs.predReminder ?? false} onChange={v => setPref('predReminder', v)} />
            </div>
            <div className="notif-toggle-row" style={{ marginTop: '.75rem' }}>
              <div>
                <div className="notif-simple-title">🎮 Nuevo juego disponible</div>
                <div className="notif-simple-desc">Cuando se abra un nuevo minijuego</div>
              </div>
              <ToggleSwitch value={prefs.newGame ?? false} onChange={v => setPref('newGame', v)} />
            </div>
          </div>

          <button className="btn-save" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar preferencias'}
          </button>
        </>
      )}
    </div>
  );
}
