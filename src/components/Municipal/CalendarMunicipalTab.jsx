import { useState, useCallback } from 'react';
import { useMatchesMunicipal } from '../../hooks/useMatchesMunicipal';
import { crestUrlMunicipal, crestUrlMunicipalFallback } from '../../lib/crests';
import LoadingSpinner from '../LoadingSpinner';
import MatchDetailModalMunicipal from './MatchDetailModalMunicipal';

const FAVORITE_TEAM = 'ASTON BIRRA';

function formatDateLabel(fecha) {
  if (!fecha) return '';
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

function groupByDate(matches) {
  const sorted = [...matches].sort((a, b) =>
    (a.fecha ?? '').localeCompare(b.fecha ?? '') || (a.hora ?? '').localeCompare(b.hora ?? '')
  );
  const groups = [];
  const seen   = new Map();
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
  const dates = matches.map(m => m.fecha).filter(Boolean).sort();
  if (!dates.length) return '';
  const fmt = s => new Date(s + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  return dates[0] === dates[dates.length - 1]
    ? fmt(dates[0])
    : `${fmt(dates[0])} – ${fmt(dates[dates.length - 1])}`;
}

function isFav(match) {
  return match.homeTeam === FAVORITE_TEAM || match.awayTeam === FAVORITE_TEAM;
}

function MatchCard({ match, onClick }) {
  const isFinished = match.status === 'finished';
  return (
    <div className={`match-card${isFav(match) ? ' match-card--favorite' : ''}`} onClick={onClick} style={{ cursor: 'pointer' }}>
      <span className="match-time-col">{match.hora || '–'}</span>
      <div className="match-middle">
        <div className="match-team home">
          <span className="team-name">{match.homeTeam}</span>
          <img className="team-crest" src={crestUrlMunicipal(match.homeTeam)} alt={match.homeTeam} onError={e => { e.target.onerror = null; e.target.src = crestUrlMunicipalFallback(match.homeTeam); }} />
        </div>
        <div className="match-score">
          {isFinished ? (
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
          <img className="team-crest" src={crestUrlMunicipal(match.awayTeam)} alt={match.awayTeam} onError={e => { e.target.onerror = null; e.target.src = crestUrlMunicipalFallback(match.awayTeam); }} />
          <span className="team-name">{match.awayTeam}</span>
        </div>
      </div>
      <div className="match-status-col">
        {isFinished
          ? <span className="status-badge finished">Final</span>
          : <span className="status-badge scheduled">Próximo</span>
        }
      </div>
    </div>
  );
}

export default function CalendarMunicipalTab() {
  const { currentRound, getMatches, totalRounds, loading, error, refresh } = useMatchesMunicipal();
  const [jornada, setJornada]         = useState(null);
  const [collapsed, setCollapsed]     = useState(new Set());
  const [filterFav, setFilterFav]     = useState(false);
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
          onClick={() => setJornada(Math.min(totalRounds || 22, activeRound + 1))}
          disabled={activeRound >= (totalRounds || 22)}
        >›</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', padding: '0 1rem .25rem', justifyContent: 'space-between' }}>
        <button
          className={`fav-filter-btn${filterFav ? ' active' : ''}`}
          onClick={() => setFilterFav(v => !v)}
        >
          <img
            src={crestUrlMunicipal(FAVORITE_TEAM)}
            alt=""
            className="team-crest team-crest--sm"
            onError={e => { e.target.onerror = null; e.target.src = crestUrlMunicipalFallback(FAVORITE_TEAM); }}
          />
          {filterFav ? `Solo ${FAVORITE_TEAM}` : FAVORITE_TEAM}
        </button>
        <button className="btn-refresh" onClick={refresh} disabled={loading} title="Actualizar partidos">↻ Actualizar</button>
      </div>

      {selectedMatch && (
        <MatchDetailModalMunicipal
          match={selectedMatch}
          onClose={() => setSelectedMatch(null)}
        />
      )}

      {matches.length === 0 ? (
        <div className="loading">No hay datos para esta jornada</div>
      ) : (
        groupByDate(matches).map(({ label, matches: group }) => {
          const isCollapsed = collapsed.has(label);
          const visible     = filterFav ? group.filter(isFav) : group;
          if (filterFav && visible.length === 0) return null;
          return (
            <div key={label}>
              <div className="date-group-header" onClick={() => toggleGroup(label)} style={{ cursor: 'pointer' }}>
                {label}
                <span className="date-group-chevron">{isCollapsed ? '›' : '‹'}</span>
              </div>
              {!isCollapsed && visible.map((m, i) => (
                <MatchCard key={`${m.fecha}-${m.hora}-${i}`} match={m} onClick={() => setSelectedMatch(m)} />
              ))}
            </div>
          );
        })
      )}
    </>
  );
}
