import { useState, useCallback } from 'react';
import { useMatches } from '../../hooks/useMatches';
import { useAuth } from '../../contexts/AuthContext';
import { crestUrl } from '../../lib/crests';
import LoadingSpinner from '../LoadingSpinner';

function formatTime(utcDate) {
  if (!utcDate) return '';
  const d = new Date(utcDate);
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
}

function groupMatchesByDate(matches) {
  const sorted = matches.slice().sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
  const groups = [];
  const seen = new Map();
  sorted.forEach(m => {
    const label = new Date(m.utcDate).toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Madrid',
    });
    if (!seen.has(label)) {
      const group = { label, matches: [] };
      seen.set(label, group);
      groups.push(group);
    }
    seen.get(label).matches.push(m);
  });
  return groups;
}

function jornadaDates(matches) {
  if (!matches.length) return '';
  const dates = matches.map(m => new Date(m.utcDate)).filter(Boolean);
  if (!dates.length) return '';
  dates.sort((a, b) => a - b);
  const first = dates[0];
  const last  = dates[dates.length - 1];
  const fmt = d => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  return first.toDateString() === last.toDateString()
    ? fmt(first)
    : `${fmt(first)} – ${fmt(last)}`;
}

function StatusBadge({ status }) {
  if (status === 'FINISHED') return <span className="status-badge finished">Final</span>;
  if (status === 'IN_PLAY' || status === 'PAUSED') return <span className="status-badge live">En juego</span>;
  return <span className="status-badge scheduled">Próximo</span>;
}

function MatchCard({ match, favorite }) {
  const isFinished = match.status === 'FINISHED';
  const isLive     = match.status === 'IN_PLAY' || match.status === 'PAUSED';

  return (
    <div className={`match-card${favorite ? ' match-card--favorite' : ''}`}>
      <span className="match-time-col">{formatTime(match.utcDate)}</span>
      <div className="match-middle">
        <div className="match-team home">
          <span className="team-name">{match.homeTeam}</span>
          <img className="team-crest" src={crestUrl(match.homeTeam)} alt={match.homeTeam} />
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
          <img className="team-crest" src={crestUrl(match.awayTeam)} alt={match.awayTeam} />
          <span className="team-name">{match.awayTeam}</span>
        </div>
      </div>
      <div className="match-status-col"><StatusBadge status={match.status} /></div>
    </div>
  );
}

export default function CalendarTab() {
  const { matchdayData, currentMatchday, getMatches, totalMatchdays, loading, error } = useMatches();
  const { profile } = useAuth();
  const [jornada, setJornada] = useState(null);
  const [collapsed, setCollapsed] = useState(new Set());
  const [filterFav, setFilterFav] = useState(false);

  const favoriteTeam = profile?.favoriteTeam || null;

  const toggleGroup = useCallback(label => {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  }, []);

  const activeJornada = jornada ?? currentMatchday;
  const matches       = getMatches(activeJornada);

  if (loading) return <LoadingSpinner text="Cargando partidos…" />;
  if (error)   return (
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
          onClick={() => setJornada(Math.max(1, activeJornada - 1))}
          disabled={activeJornada <= 1}
        >‹</button>
        <div>
          <h2>Jornada {activeJornada}</h2>
          <span className="dates">{jornadaDates(matches)}</span>
        </div>
        <button
          className="btn-nav"
          onClick={() => setJornada(Math.min(totalMatchdays || 38, activeJornada + 1))}
          disabled={activeJornada >= (totalMatchdays || 38)}
        >›</button>
      </div>

      {favoriteTeam && (
        <button
          className={`fav-filter-btn${filterFav ? ' active' : ''}`}
          onClick={() => setFilterFav(v => !v)}
        >
          <img src={crestUrl(favoriteTeam)} alt={favoriteTeam} />
          {filterFav ? `Solo ${favoriteTeam}` : favoriteTeam}
        </button>
      )}

      {matches.length === 0 ? (
        <div className="loading">No hay datos para esta jornada</div>
      ) : (
        groupMatchesByDate(matches).map(({ label, matches: group }) => {
          const isCollapsed = collapsed.has(label);
          const visible = filterFav && favoriteTeam
            ? group.filter(m => m.homeTeam === favoriteTeam || m.awayTeam === favoriteTeam)
            : group;
          if (filterFav && visible.length === 0) return null;
          return (
            <div key={label}>
              <div className="date-group-header" onClick={() => toggleGroup(label)} style={{ cursor: 'pointer' }}>
                {label}
                <span className="date-group-chevron">{isCollapsed ? '›' : '‹'}</span>
              </div>
              {!isCollapsed && visible.map(m => (
                <MatchCard
                  key={m.matchId}
                  match={m}
                  favorite={favoriteTeam && (m.homeTeam === favoriteTeam || m.awayTeam === favoriteTeam)}
                />
              ))}
            </div>
          );
        })
      )}
    </>
  );
}
