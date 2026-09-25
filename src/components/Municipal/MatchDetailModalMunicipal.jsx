import { useEffect } from 'react';
import { crestUrlMunicipal, crestUrlMunicipalFallback } from '../../lib/crests';
import { useScrollLock } from '../../hooks/useScrollLock';
import { useCampoRffm } from '../../hooks/useCampoRffm';

const VENUE_CODE = 103;

export default function MatchDetailModalMunicipal({ match, onClose }) {
  useScrollLock('match-detail-panel');

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

        <div className="md-section">
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
        </div>
      </div>
    </div>
  );
}
