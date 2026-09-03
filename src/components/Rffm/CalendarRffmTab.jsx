import { useState, useCallback } from 'react';
import { useMatchesRffm } from '../../hooks/useMatchesRffm';
import { useCampoRffm } from '../../hooks/useCampoRffm';
import { crestUrlRffm } from '../../lib/crests';
import { shortName } from '../../lib/rffmTeams';
import LoadingSpinner from '../LoadingSpinner';

const FAVORITE_TEAM = 'S.A.D. OCIO Y DEPORTE CANAL A';
const FAVORITE_LOGO = 'crests-rffm/6819372.png';

function formatDateLabel(fecha) {
  if (!fecha) return '';
  const d = new Date(fecha.slice(0, 10) + 'T12:00:00');
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}

function groupByDate(matches) {
  const sorted = [...matches].sort((a, b) => (a.fecha ?? '').localeCompare(b.fecha ?? ''));
  const groups = [];
  const seen = new Map();
  for (const m of sorted) {
    const label = formatDateLabel(m.fecha);
    if (!seen.has(label)) {
      const g = { label, matches: [] };
      seen.set(label, g);
      groups.push(g);
    }
    seen.get(label).matches.push(m);
  }
  return groups;
}

function roundDates(matches) {
  if (!matches.length) return '';
  const dates = matches.map(m => m.fecha?.slice(0, 10)).filter(Boolean).sort();
  if (!dates.length) return '';
  const fmt = s => new Date(s + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  return dates[0] === dates[dates.length - 1] ? fmt(dates[0]) : `${fmt(dates[0])} – ${fmt(dates[dates.length - 1])}`;
}

function StatusBadge({ status }) {
  if (status === 'finished') return <span className="status-badge finished">Final</span>;
  if (status === 'live')     return <span className="status-badge live">En juego</span>;
  return <span className="status-badge scheduled">Próximo</span>;
}

function isFavMatch(match) {
  return match.homeTeam === FAVORITE_TEAM || match.awayTeam === FAVORITE_TEAM;
}

function MatchCard({ match, onClick }) {
  const isFinished = match.status === 'finished';
  const isLive     = match.status === 'live';

  return (
    <div
      className={`match-card${isFavMatch(match) ? ' match-card--favorite' : ''}`}
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      <span className="match-time-col">{match.hora || '–'}</span>
      <div className="match-middle">
        <div className="match-team home">
          <span className="team-name">{shortName(match.homeTeam)}</span>
          <img className="team-crest" src={crestUrlRffm(match.homeLogo)} alt={match.homeTeam} />
        </div>
        <div className="match-score">
          {isFinished || isLive ? (
            <>
              <span>{match.homeScore ?? '–'}</span>
              <span className="sep">:</span>
              <span>{match.awayScore ?? '–'}</span>
            </>
          ) : (
            <span className="sep">–</span>
          )}
        </div>
        <div className="match-team away">
          <img className="team-crest" src={crestUrlRffm(match.awayLogo)} alt={match.awayTeam} />
          <span className="team-name">{shortName(match.awayTeam)}</span>
        </div>
      </div>
      <div className="match-status-col">
        <StatusBadge status={match.status} />
      </div>
    </div>
  );
}

function MatchDetailRffm({ match, onClose }) {
  const isFinished = match.status === 'finished';
  const isLive     = match.status === 'live';
  const hasScore   = isFinished || isLive;
  const { campo, loading: campoLoading } = useCampoRffm(match.venueCode);

  const mapsUrl = campo?.lat && campo?.lng
    ? `https://www.google.com/maps/search/?api=1&query=${campo.lat},${campo.lng}`
    : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="match-detail-panel" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>

        <div className="md-header">
          <div className="md-team">
            <img className="md-crest" src={crestUrlRffm(match.homeLogo)} alt={match.homeTeam} />
            <span className="md-team-name">{shortName(match.homeTeam)}</span>
          </div>
          <div className="md-score-block">
            {hasScore ? (
              <div className="md-score-main">
                <span>{match.homeScore}</span>
                <span className="md-sep">:</span>
                <span>{match.awayScore}</span>
              </div>
            ) : (
              <div className="md-score-main">
                <span className="md-vs">–</span>
              </div>
            )}
            <div className="md-status">
              <StatusBadge status={match.status} />
            </div>
          </div>
          <div className="md-team">
            <img className="md-crest" src={crestUrlRffm(match.awayLogo)} alt={match.awayTeam} />
            <span className="md-team-name">{shortName(match.awayTeam)}</span>
          </div>
        </div>

        {match.fecha && (
          <div className="md-meta">
            <span>
              {new Date(match.fecha.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-ES', {
                weekday: 'long', day: 'numeric', month: 'long'
              })}
            </span>
            {match.hora && <span>· {match.hora}</span>}
          </div>
        )}

        {match.venue && (
          <div className="md-section">
            <p className="md-section-title">Campo</p>
            {campoLoading ? (
              <div className="md-meta" style={{ color: 'var(--muted)', fontSize: '.8rem' }}>Cargando…</div>
            ) : campo ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.35rem', fontSize: '.82rem' }}>
                <span style={{ fontWeight: 600 }}>{campo.nombre}</span>
                {(campo.direccion || campo.localidad) && (
                  <span style={{ color: 'var(--muted)' }}>
                    {[campo.direccion, campo.localidad].filter(Boolean).join(', ')}
                  </span>
                )}
                {(campo.superficie || campo.tipo) && (
                  <span style={{ color: 'var(--muted)' }}>
                    {[campo.tipo, campo.superficie].filter(Boolean).join(' · ')}
                  </span>
                )}
                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--accent)', marginTop: '.15rem' }}
                  >
                    Ver en Google Maps
                  </a>
                )}
              </div>
            ) : (
              <div className="md-meta">{match.venue}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CalendarRffmTab() {
  const { currentRound, getMatches, totalRounds, loading, error } = useMatchesRffm();
  const [jornada, setJornada]           = useState(null);
  const [collapsed, setCollapsed]       = useState(new Set());
  const [filterFav, setFilterFav]       = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);

  const toggleGroup = useCallback(label => {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  }, []);

  const activeRound = jornada ?? currentRound;
  const matches     = getMatches(activeRound);

  if (loading) return <LoadingSpinner text="Cargando partidos…" />;
  if (error) return (
    <div className="empty-state">
      <img src={`${import.meta.env.BASE_URL}icon-error.png`} alt="" className="empty-icon" />
      <p style={{ color: 'var(--accent)' }}>Error al cargar los partidos.<br />Inténtalo de nuevo.</p>
    </div>
  );

  return (
    <>
      {selectedMatch && (
        <MatchDetailRffm match={selectedMatch} onClose={() => setSelectedMatch(null)} />
      )}
      <div className="jornada-nav">
        <button
          className="btn-nav"
          onClick={() => setJornada(Math.max(1, activeRound - 1))}
          disabled={activeRound <= 1}
        >‹</button>
        <div>
          <h2>Jornada {activeRound}</h2>
          <span className="dates">{roundDates(matches)}</span>
        </div>
        <button
          className="btn-nav"
          onClick={() => setJornada(Math.min(totalRounds || 34, activeRound + 1))}
          disabled={activeRound >= (totalRounds || 34)}
        >›</button>
      </div>

      <button
        className={`fav-filter-btn${filterFav ? ' active' : ''}`}
        onClick={() => setFilterFav(v => !v)}
      >
        <img src={crestUrlRffm(FAVORITE_LOGO)} alt="Ocio y Deporte Canal" />
        {filterFav ? 'Solo Ocio y Deporte Canal' : 'Ocio y Deporte Canal'}
      </button>

      {matches.length === 0 ? (
        <div className="loading">No hay datos para esta jornada</div>
      ) : (
        groupByDate(matches).map(({ label, matches: group }) => {
          const isCollapsed = collapsed.has(label);
          const visible = filterFav
            ? group.filter(m => isFavMatch(m))
            : group;
          if (filterFav && visible.length === 0) return null;
          return (
            <div key={label}>
              <div className="date-group-header" onClick={() => toggleGroup(label)} style={{ cursor: 'pointer' }}>
                {label}
                <span className="date-group-chevron">{isCollapsed ? '›' : '‹'}</span>
              </div>
              {!isCollapsed && visible.map((m, i) => (
                <MatchCard key={m.matchId ?? i} match={m} onClick={() => setSelectedMatch(m)} />
              ))}
            </div>
          );
        })
      )}
    </>
  );
}
