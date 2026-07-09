import { useState } from 'react';
import { useMatches } from '../../hooks/useMatches';
import { crestUrl } from '../../lib/crests';

function formatDate(utcDate) {
  if (!utcDate) return '';
  const d = new Date(utcDate);
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatTime(utcDate) {
  if (!utcDate) return '';
  const d = new Date(utcDate);
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
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

function MatchCard({ match }) {
  const isFinished = match.status === 'FINISHED';
  const isLive     = match.status === 'IN_PLAY' || match.status === 'PAUSED';

  return (
    <div className="match-card">
      <div className="match-team home">
        {match.homeTeam}
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
          <span style={{ fontSize: '.8rem', color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
            {formatTime(match.utcDate)}
          </span>
        )}
      </div>
      <div className="match-team away">
        <img className="team-crest" src={crestUrl(match.awayTeam)} alt={match.awayTeam} />
        {match.awayTeam}
      </div>
      <div className="match-time">
        {formatDate(match.utcDate)}&nbsp;&nbsp;
        <StatusBadge status={match.status} />
      </div>
    </div>
  );
}

export default function CalendarTab() {
  const { matchdayData, currentMatchday, getMatches, totalMatchdays, loading, error } = useMatches();
  const [jornada, setJornada] = useState(null);

  const activeJornada = jornada ?? currentMatchday;
  const matches       = getMatches(activeJornada);

  if (loading) return <div className="loading">Cargando partidos…</div>;
  if (error)   return <div className="loading" style={{ color: 'var(--accent)' }}>Error: {error}</div>;

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

      {matches.length === 0 ? (
        <div className="loading">No hay datos para esta jornada</div>
      ) : (
        matches
          .slice()
          .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate))
          .map(m => <MatchCard key={m.matchId} match={m} />)
      )}
    </>
  );
}
