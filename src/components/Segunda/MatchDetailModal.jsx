import { useEffect } from 'react';
import { crestUrlSegunda } from '../../lib/crests';
import { abbr, canonicalize } from '../../lib/segundaTeams';
import LoadingSpinner from '../LoadingSpinner';

function formatDateLong(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid',
  });
}

function formatDateShort(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Madrid',
  });
}

function WeatherIcon({ code }) {
  if (code == null) return null;
  if (code <= 3)  return '☀️';
  if (code <= 9)  return '🌤️';
  if (code <= 19) return '🌫️';
  if (code <= 29) return '🌧️';
  if (code <= 39) return '🌨️';
  if (code <= 49) return '🌩️';
  if (code <= 59) return '🌧️';
  if (code <= 69) return '❄️';
  return '🌦️';
}

function H2HTeam({ name, align, dim }) {
  const canonical = canonicalize(name);
  return (
    <span className={`h2h-team h2h-team--${align}${dim ? ' h2h-team--dim' : ''}`}>
      <img className="team-crest team-crest--sm" src={crestUrlSegunda(canonical)} alt="" />
      <span>{abbr(name)}</span>
    </span>
  );
}

function H2HRow({ m }) {
  const [hs, as] = m.score.split('-').map(Number);
  const draw     = hs === as;
  return (
    <tr>
      <td className="h2h-date">{formatDateShort(m.date)}</td>
      <td className="h2h-home"><H2HTeam name={m.home} align="home" dim={!draw && hs < as} /></td>
      <td className={`h2h-score${draw ? ' h2h-score--draw' : ''}`}>{m.score}</td>
      <td className="h2h-away"><H2HTeam name={m.away} align="away" dim={!draw && as < hs} /></td>
    </tr>
  );
}

export default function MatchDetailModal({ detail, loading, error, onClose }) {
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const isFinished = detail?.status === 'finished';
  const isLive     = ['live', 'in_progress', 'halftime'].includes(detail?.status);
  const h2h        = detail?.head_to_head;
  const highlight  = detail?.highlights?.[0];
  const weather    = detail?.weather;
  const hasHT      = detail?.home_score_ht != null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel match-detail-panel" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>

        {loading && <LoadingSpinner text="Cargando detalles…" />}

        {error && !loading && (
          <p style={{ color: 'var(--hm-accent)', textAlign: 'center', padding: '2rem' }}>
            Error al cargar los detalles.
          </p>
        )}

        {detail && !loading && (
          <>
            {/* Cabecera: equipos + resultado */}
            <div className="md-header">
              <div className="md-team">
                <img className="md-crest" src={crestUrlSegunda(detail.home_team)} alt="" />
                <span className="md-team-name">{detail.home_team}</span>
              </div>

              <div className="md-score-block">
                {(isFinished || isLive) ? (
                  <>
                    <div className="md-score-main">
                      <span>{detail.home_score}</span>
                      <span className="md-sep">-</span>
                      <span>{detail.away_score}</span>
                    </div>
                    {hasHT && (
                      <div className="md-score-ht">
                        ({detail.home_score_ht} - {detail.away_score_ht}) HT
                      </div>
                    )}
                    <div className="md-status">
                      {isFinished ? 'Final' : detail.status === 'halftime' ? 'Descanso' : `${detail.current_minute}'`}
                    </div>
                  </>
                ) : (
                  <div className="md-score-main md-vs">VS</div>
                )}
              </div>

              <div className="md-team">
                <img className="md-crest" src={crestUrlSegunda(detail.away_team)} alt="" />
                <span className="md-team-name">{detail.away_team}</span>
              </div>
            </div>

            {/* Fecha + clima */}
            <div className="md-meta">
              <span>{formatDateLong(detail.event_date)}</span>
              {weather?.temperature_c != null && (
                <span className="md-weather">
                  <WeatherIcon code={weather.code} /> {Math.round(weather.temperature_c)}°C
                  {weather.wind_speed != null && ` · ${Math.round(weather.wind_speed)} km/h`}
                </span>
              )}
            </div>

            {/* Highlights */}
            {highlight && (
              <div className="md-section">
                <h4 className="md-section-title">Highlights</h4>
                <a
                  href={highlight.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="md-highlight-link"
                >
                  {highlight.thumbnail && (
                    <img className="md-thumbnail" src={highlight.thumbnail} alt="Highlights" />
                  )}
                  <span className="md-highlight-label">▶ Ver highlights completos</span>
                </a>
              </div>
            )}

            {/* Head-to-head */}
            {h2h && h2h.total_matches > 0 && (
              <div className="md-section">
                <h4 className="md-section-title">Historial entre sí</h4>
                <div className="md-h2h-summary">
                  <div className="md-h2h-stat">
                    <span className="md-h2h-num">{h2h.home_wins}</span>
                    <span className="md-h2h-label">{detail.home_team}</span>
                  </div>
                  <div className="md-h2h-stat">
                    <span className="md-h2h-num">{h2h.draws}</span>
                    <span className="md-h2h-label">Empates</span>
                  </div>
                  <div className="md-h2h-stat">
                    <span className="md-h2h-num">{h2h.away_wins}</span>
                    <span className="md-h2h-label">{detail.away_team}</span>
                  </div>
                </div>

                {h2h.recent_matches?.length > 0 && (
                  <table className="md-h2h-table">
                    <tbody>
                      {h2h.recent_matches.map((m, i) => (
                        <H2HRow key={i} m={m} />
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
