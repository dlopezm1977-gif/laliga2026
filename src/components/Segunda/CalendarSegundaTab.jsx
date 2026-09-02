import { useState, useCallback } from 'react';
import { useMatchesSegunda } from '../../hooks/useMatchesSegunda';
import { useMatchDetailSegunda } from '../../hooks/useMatchDetailSegunda';
import { crestUrlSegunda } from '../../lib/crests';
import LoadingSpinner from '../LoadingSpinner';
import MatchDetailModal from './MatchDetailModal';

function formatTime(utcDate) {
  if (!utcDate) return '';
  return new Date(utcDate).toLocaleTimeString('es-ES', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid',
  });
}

function groupByDate(matches) {
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

function roundDates(matches) {
  if (!matches.length) return '';
  const dates = matches.map(m => new Date(m.utcDate)).filter(Boolean).sort((a, b) => a - b);
  const fmt = d => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  return dates[0].toDateString() === dates[dates.length - 1].toDateString()
    ? fmt(dates[0])
    : `${fmt(dates[0])} – ${fmt(dates[dates.length - 1])}`;
}

function StatusBadge({ status, period, minute }) {
  const isLive = status === 'live' || status === 'in_progress' || status === 'halftime';
  if (status === 'finished') return <span className="status-badge finished">Final</span>;
  if (isLive) {
    const label = status === 'halftime' ? 'Descanso' : (minute ? `${minute}'` : 'En juego');
    return <span className="status-badge live">{label}</span>;
  }
  return <span className="status-badge scheduled">Próximo</span>;
}

function MatchCard({ match, onOpenDetail }) {
  const isFinished = match.status === 'finished';
  const isLive     = match.status === 'live' || match.status === 'in_progress' || match.status === 'halftime';

  return (
    <div className="match-card" onClick={() => onOpenDetail(match.matchId)} style={{ cursor: 'pointer' }}>
      <span className="match-time-col">{formatTime(match.utcDate)}</span>
      <div className="match-middle">
        <div className="match-team home">
          <span className="team-name">{match.homeTeam}</span>
          <img className="team-crest" src={crestUrlSegunda(match.homeTeam)} alt={match.homeTeam} />
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
          <img className="team-crest" src={crestUrlSegunda(match.awayTeam)} alt={match.awayTeam} />
          <span className="team-name">{match.awayTeam}</span>
        </div>
      </div>
      <div className="match-status-col">
        <StatusBadge status={match.status} period={match.period} minute={match.currentMinute} />
      </div>
    </div>
  );
}

export default function CalendarSegundaTab() {
  const { currentRound, getMatches, totalRounds, loading, error } = useMatchesSegunda();
  const { detail, loading: loadingDetail, error: errorDetail, open, close } = useMatchDetailSegunda();
  const [jornada, setJornada]     = useState(null);
  const [collapsed, setCollapsed] = useState(new Set());

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
      <p style={{ color: 'var(--hm-accent)' }}>Error al cargar los partidos.<br />Inténtalo de nuevo.</p>
    </div>
  );

  return (
    <>
      {(detail || loadingDetail || errorDetail) && (
        <MatchDetailModal
          detail={detail}
          loading={loadingDetail}
          error={errorDetail}
          onClose={close}
        />
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
          onClick={() => setJornada(Math.min(totalRounds || 42, activeRound + 1))}
          disabled={activeRound >= (totalRounds || 42)}
        >›</button>
      </div>

      {matches.length === 0 ? (
        <div className="loading">No hay datos para esta jornada</div>
      ) : (
        groupByDate(matches).map(({ label, matches: group }) => {
          const isCollapsed = collapsed.has(label);
          return (
            <div key={label}>
              <div className="date-group-header" onClick={() => toggleGroup(label)} style={{ cursor: 'pointer' }}>
                {label}
                <span className="date-group-chevron">{isCollapsed ? '›' : '‹'}</span>
              </div>
              {!isCollapsed && group.map(m => (
                <MatchCard key={m.matchId} match={m} onOpenDetail={open} />
              ))}
            </div>
          );
        })
      )}
    </>
  );
}
