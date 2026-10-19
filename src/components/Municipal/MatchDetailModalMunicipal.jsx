import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { isMunicipalAdmin } from '../../lib/municipalDetail';
import MatchDetailFormMunicipal from './MatchDetailFormMunicipal';
import { crestUrlMunicipal, crestUrlMunicipalFallback } from '../../lib/crests';
import { useScrollLock } from '../../hooks/useScrollLock';
import { useCampoRffm } from '../../hooks/useCampoRffm';

const VENUE_CODE = 103;
const FAVORITE_TEAM = 'ASTON BIRRA';

const TABS = [
  { id: 'campo',        label: 'Campo' },
  { id: 'alineaciones', label: 'Alineación' },
  { id: 'incidencias',  label: 'Incidencias' },
];

function LineupTeam({ label, players }) {
  const sorted = [...(players ?? [])].sort((a, b) =>
    (b.portero ? 1 : 0) - (a.portero ? 1 : 0) || (a.dorsal ?? 999) - (b.dorsal ?? 999)
  );
  return (
    <div className="md-lineup-col">
      <div className="md-lineup-header">{label}</div>
      {sorted.length === 0 && <div className="md-lineup-player" style={{ opacity: .6 }}>Sin datos</div>}
      {sorted.map((p, i) => (
        <div key={i} className="md-lineup-player">
          <span className="md-lineup-num">{p.dorsal ?? ''}</span>
          <span className="md-lineup-name">{p.nombre}{p.capitan ? ' ©' : ''}</span>
          {p.portero && <span className="md-lineup-pos md-lineup-pos--g">POR</span>}
        </div>
      ))}
    </div>
  );
}

function IncSection({ title, home, away, renderItem }) {
  if (!home.length && !away.length) return null;
  return (
    <div className="md-inc-section">
      <div className="md-inc-section-title">{title}</div>
      <div className="md-inc-cols">
        <div className="md-inc-col">{home.map((it, i) => <div key={i}>{renderItem(it)}</div>)}</div>
        <div className="md-inc-col md-inc-col--away">{away.map((it, i) => <div key={i}>{renderItem(it)}</div>)}</div>
      </div>
    </div>
  );
}

export default function MatchDetailModalMunicipal({ match, season, round, onClose, onSaved }) {
  useScrollLock('match-detail-panel');
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('campo');
  const [editing, setEditing]     = useState(false);
  const canEdit = isMunicipalAdmin(user)
    && (match?.homeTeam === FAVORITE_TEAM || match?.awayTeam === FAVORITE_TEAM)
    && season != null && round != null;

  const { campo } = useCampoRffm(VENUE_CODE);

  const mapsUrl = campo?.lat && campo?.lng
    ? `https://www.google.com/maps/search/?api=1&query=${campo.lat},${campo.lng}`
    : null;

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!match) return null;

  const isFinished = match.status === 'finished';

  function crest(name) {
    return (
      <img
        className="md-crest"
        src={crestUrlMunicipal(name)}
        alt={name}
        onError={e => { e.target.onerror = null; e.target.src = crestUrlMunicipalFallback(name); }}
      />
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel match-detail-panel match-detail-panel--laliga" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>

        <div className="md-header">
          <div className="md-team">
            {crest(match.homeTeam)}
            <span className="md-team-name">{match.homeTeam}</span>
          </div>
          <div className="md-score-block">
            {isFinished ? (
              <div className="md-score-main">
                <span>{match.homeScore ?? '–'}</span>
                <span className="md-sep">:</span>
                <span>{match.awayScore ?? '–'}</span>
              </div>
            ) : (
              <div className="md-score-main"><span className="md-vs">–</span></div>
            )}
            <div className="md-status">
              {isFinished
                ? <span className="status-badge finished">Final</span>
                : <span className="status-badge scheduled">Próximo</span>}
            </div>
          </div>
          <div className="md-team">
            {crest(match.awayTeam)}
            <span className="md-team-name">{match.awayTeam}</span>
          </div>
        </div>

        {match.fecha && (
          <div className="md-meta">
            <span>
              {new Date(match.fecha.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-ES', {
                weekday: 'long', day: 'numeric', month: 'long',
              })}
            </span>
            {match.hora && <span>· {match.hora}</span>}
            {match.jornada && <span>· Jornada {match.jornada}</span>}
          </div>
        )}

        {match.detail && !editing && (
          <div className="md-tabs">
            {TABS.map(t => (
              <button key={t.id} className={`md-tab-btn${activeTab === t.id ? ' active' : ''}`} onClick={() => setActiveTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
        )}

        {editing && (
          <MatchDetailFormMunicipal
            match={match}
            season={season}
            round={round}
            onCancel={() => setEditing(false)}
            onSaved={detail => { setEditing(false); onSaved?.(detail); }}
          />
        )}

        {!editing && match.detail && activeTab === 'alineaciones' && (
          <div className="md-lineups">
            <LineupTeam label={match.homeTeam} players={match.detail.home} />
            <LineupTeam label={match.awayTeam} players={match.detail.away} />
          </div>
        )}

        {!editing && match.detail && activeTab === 'incidencias' && (() => {
          const goals = match.detail.goals ?? [];
          const cards = match.detail.cards ?? [];
          // Un gol en propia cuenta en la columna del equipo contrario
          const goalCol = g => (g.tipo === 'pp' ? (g.team === 'home' ? 'away' : 'home') : g.team);
          return (
            <div className="md-incidents-v2">
              <div className="md-inc-col-headers"><span>{match.homeTeam}</span><span>{match.awayTeam}</span></div>
              <IncSection
                title="⚽ Goles"
                home={goals.filter(g => goalCol(g) === 'home')}
                away={goals.filter(g => goalCol(g) === 'away')}
                renderItem={g => (
                  <div className="md-inc-item md-inc-item--goal">
                    <span className="md-inc-player">⚽ {g.nombre}</span>
                    {g.tipo === 'pp' && <span className="md-inc-note">(PP)</span>}
                    {g.tipo === 'penalti' && <span className="md-inc-note">(P)</span>}
                  </div>
                )}
              />
              <IncSection
                title="Tarjetas"
                home={cards.filter(c => c.team === 'home')}
                away={cards.filter(c => c.team === 'away')}
                renderItem={c => (
                  <div className="md-inc-item">
                    <span className={`md-card md-card--${c.tipo === 'roja' ? 'red' : 'yellow'}`} style={{ margin: '0 .2rem' }} />
                    <span className="md-inc-player">{c.nombre}</span>
                  </div>
                )}
              />
              {!goals.length && !cards.length && (
                <p style={{ color: 'var(--muted)', textAlign: 'center', fontSize: '.82rem', padding: '.5rem 0' }}>
                  Sin incidencias registradas.
                </p>
              )}
            </div>
          );
        })()}

        {canEdit && !editing && (
          <div style={{ padding: '.6rem 1rem 0', textAlign: 'center' }}>
            <button type="button" className="mdf-edit-btn" onClick={() => setEditing(true)}>
              ✏️ {match.detail ? 'Editar detalle' : 'Añadir detalle'}
            </button>
          </div>
        )}

        {!editing && activeTab === 'campo' && <div className="md-section">
          {campo ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.35rem', fontSize: '.82rem' }}>
              <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '.4rem' }}>
                <span>🏟</span>{campo.nombre}
              </span>
              {(campo.direccion || campo.localidad) && (
                <span style={{ color: 'var(--muted)' }}>
                  {[campo.direccion, campo.localidad].filter(Boolean).join(', ')}
                </span>
              )}
              <span style={{ color: 'var(--muted)' }}>
                Fútbol Sala{campo.superficie ? ` · ${campo.superficie}` : ''}
              </span>
              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '.35rem',
                    marginTop: '.4rem', padding: '.35rem .75rem',
                    background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent)',
                    borderRadius: '999px', fontSize: '.75rem', fontWeight: 600,
                    textDecoration: 'none', letterSpacing: '.02em',
                  }}
                >
                  <svg width="10" height="12" viewBox="0 0 12 16" fill="currentColor" aria-hidden="true">
                    <path d="M6 0C3.24 0 1 2.24 1 5c0 4.25 5 11 5 11s5-6.75 5-11c0-2.76-2.24-5-5-5zm0 7.5A2.5 2.5 0 1 1 6 2.5 2.5 2.5 0 0 1 6 7.5z"/>
                  </svg>
                  Ver en Google Maps
                </a>
              )}
            </div>
          ) : (
            <div className="md-meta" style={{ color: 'var(--muted)', fontSize: '.8rem' }}>
              🏟 CANAL ISABEL II (HA) · Madrid
            </div>
          )}
        </div>}
      </div>
    </div>
  );
}
