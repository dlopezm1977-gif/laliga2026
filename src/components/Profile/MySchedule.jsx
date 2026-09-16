import { useMemo, useState } from 'react';
import { useMatchesRffm } from '../../hooks/useMatchesRffm';
import { useMatchDetailLaliga } from '../../hooks/useMatchDetailLaliga';
import { useMatchDetailSegunda } from '../../hooks/useMatchDetailSegunda';
import { useMatchDetailRffm } from '../../hooks/useMatchDetailRffm';
import { crestUrl, crestUrlSegunda, crestUrlRffm } from '../../lib/crests';
import { shortName as rffmShortName } from '../../lib/rffmTeams';
import { canonicalize } from '../../lib/segundaTeams';
import MatchDetailModalLaliga from '../Calendar/MatchDetailModalLaliga';
import MatchDetailModal from '../Segunda/MatchDetailModal';
import MatchDetailModalRffm from '../Rffm/MatchDetailModalRffm';

const CANAL = 'S.A.D. OCIO Y DEPORTE CANAL A';
const LIVE_STATUSES = new Set(['live', 'in_progress', 'halftime', '1st_half', '2nd_half', 'extra_time', 'penalties']);

const COMP_BADGE = {
  primera: { label: 'LaLiga',  color: '#ee3524' },
  segunda: { label: '2ª Div.', color: '#00c4b4' },
  juvenil: { label: 'Juv.',    color: '#f59e0b' },
};

function getWeekRange(offset) {
  const now = new Date();
  const day = now.getDay();
  const diff = -((day - 2 + 7) % 7); // semana empieza el martes
  const tuesday = new Date(now);
  tuesday.setDate(now.getDate() + diff + offset * 7);
  tuesday.setHours(0, 0, 0, 0);
  const monday = new Date(tuesday);
  monday.setDate(tuesday.getDate() + 6);
  monday.setHours(23, 59, 59, 999);
  return { start: tuesday, end: monday };
}

function madridStr(date) {
  return date.toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
}

function getMatchDateStr(m, comp) {
  if (comp === 'juvenil') return m.fecha?.slice(0, 10) ?? null;
  return m.utcDate ? madridStr(new Date(m.utcDate)) : null;
}

function getMatchTimestamp(m, comp) {
  if (comp === 'juvenil') {
    if (!m.fecha) return null;
    return new Date(m.fecha.includes('T') ? m.fecha : `${m.fecha}T00:00`).getTime();
  }
  return m.utcDate ? new Date(m.utcDate).getTime() : null;
}

function formatWeekLabel(start, end) {
  const opts = { day: 'numeric', month: 'short', timeZone: 'Europe/Madrid' };
  return `${start.toLocaleDateString('es-ES', opts)} – ${end.toLocaleDateString('es-ES', opts)}`;
}

function formatDayLabel(dateStr) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, mo - 1, d, 12));
  const label = date.toLocaleDateString('es-ES', {
    timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function getStatus(m, comp) {
  if (comp === 'juvenil') {
    if (m.status === 'live') return 'live';
    if (m.status === 'finished' || m.actaCerrada) return 'finished';
    return 'scheduled';
  }
  if (LIVE_STATUSES.has(m.status)) return 'live';
  if (m.status === 'finished') return 'finished';
  return 'scheduled';
}

function getTime(m, comp) {
  if (comp === 'juvenil') return m.hora || null;
  if (!m.utcDate) return null;
  const t = new Date(m.utcDate).toLocaleTimeString('es-ES', {
    timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hour12: false,
  });
  return t === '00:00' ? null : t;
}

function MatchRow({ m, comp, onClick }) {
  const badge = COMP_BADGE[comp];
  const status = getStatus(m, comp);
  const isFinished = status === 'finished';
  const isLive = status === 'live';
  const time = getTime(m, comp);

  let homeName, awayName, homeCrest, awayCrest;
  if (comp === 'primera') {
    homeName = m.homeTeam; awayName = m.awayTeam;
    homeCrest = crestUrl(m.homeTeam); awayCrest = crestUrl(m.awayTeam);
  } else if (comp === 'segunda') {
    homeName = canonicalize(m.homeTeam); awayName = canonicalize(m.awayTeam);
    homeCrest = crestUrlSegunda(homeName); awayCrest = crestUrlSegunda(awayName);
  } else {
    homeName = rffmShortName(m.homeTeam); awayName = rffmShortName(m.awayTeam);
    homeCrest = crestUrlRffm(m.homeLogo); awayCrest = crestUrlRffm(m.awayLogo);
  }

  return (
    <div className="sched-row sched-row--clickable" onClick={onClick}>
      <div className="sched-row-meta">
        <span className="sched-comp-badge" style={{ '--badge-color': badge.color }}>{badge.label}</span>
        {time && <span className="sched-time">{time}</span>}
        {isLive && <span className="sched-live">En vivo</span>}
      </div>
      <div className="sched-teams">
        <div className="sched-team sched-team--home">
          <span className="sched-name">{homeName}</span>
          <img className="sched-crest" src={homeCrest} alt={homeName} />
        </div>
        <div className="sched-score-col">
          {(isFinished || isLive)
            ? <span className="sched-score">{m.homeScore ?? '–'} – {m.awayScore ?? '–'}</span>
            : <span className="sched-vs">vs</span>}
        </div>
        <div className="sched-team sched-team--away">
          <img className="sched-crest" src={awayCrest} alt={awayName} />
          <span className="sched-name">{awayName}</span>
        </div>
      </div>
    </div>
  );
}

export default function MySchedule({ matchdayData, roundDataSegunda, favoriteTeam, favoriteTeamSegunda }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedMatch, setSelectedMatch] = useState(null); // { match, comp }

  const { roundData: roundDataRffm, loading: loadingRffm } = useMatchesRffm();
  const laliga  = useMatchDetailLaliga();
  const segunda = useMatchDetailSegunda();
  const rffm    = useMatchDetailRffm();

  const { start, end } = useMemo(() => getWeekRange(weekOffset), [weekOffset]);

  const grouped = useMemo(() => {
    const startStr = madridStr(start);
    const endStr   = madridStr(end);
    const all = [];

    if (favoriteTeam) {
      Object.values(matchdayData).flat().forEach(m => {
        if (m.homeTeam !== favoriteTeam && m.awayTeam !== favoriteTeam) return;
        const dateStr = getMatchDateStr(m, 'primera');
        if (!dateStr || dateStr < startStr || dateStr > endStr) return;
        all.push({ m, comp: 'primera', dateStr, ts: getMatchTimestamp(m, 'primera') ?? 0 });
      });
    }

    if (favoriteTeamSegunda) {
      Object.values(roundDataSegunda).flat().forEach(m => {
        const home = canonicalize(m.homeTeam);
        const away = canonicalize(m.awayTeam);
        if (home !== favoriteTeamSegunda && away !== favoriteTeamSegunda) return;
        const dateStr = getMatchDateStr(m, 'segunda');
        if (!dateStr || dateStr < startStr || dateStr > endStr) return;
        all.push({ m, comp: 'segunda', dateStr, ts: getMatchTimestamp(m, 'segunda') ?? 0 });
      });
    }

    Object.values(roundDataRffm).flat().forEach(m => {
      if (m.homeTeam !== CANAL && m.awayTeam !== CANAL) return;
      const dateStr = getMatchDateStr(m, 'juvenil');
      if (!dateStr || dateStr < startStr || dateStr > endStr) return;
      all.push({ m, comp: 'juvenil', dateStr, ts: getMatchTimestamp(m, 'juvenil') ?? 0 });
    });

    all.sort((a, b) => a.dateStr !== b.dateStr ? a.dateStr.localeCompare(b.dateStr) : a.ts - b.ts);

    const groups = [];
    for (const item of all) {
      const last = groups[groups.length - 1];
      if (last && last.dateStr === item.dateStr) last.items.push(item);
      else groups.push({ dateStr: item.dateStr, items: [item] });
    }
    return groups;
  }, [start, end, matchdayData, roundDataSegunda, roundDataRffm, favoriteTeam, favoriteTeamSegunda]);

  function handleMatchClick(m, comp) {
    setSelectedMatch({ match: m, comp });
    if (comp === 'primera') laliga.open(m.matchId);
    else if (comp === 'segunda') segunda.open(m.matchId);
    else rffm.open(m.matchId);
  }

  function handleClose() {
    setSelectedMatch(null);
    laliga.close();
    segunda.close();
    rffm.close();
  }

  return (
    <div className="sched-wrap">
      <div className="sched-title-row">
        <span className="modal-label">Mis partidos</span>
        {weekOffset !== 0 && (
          <button className="sched-today-btn" onClick={() => setWeekOffset(0)}>Hoy</button>
        )}
      </div>
      <div className="sched-nav">
        <button className="btn-nav" onClick={() => setWeekOffset(o => o - 1)}>‹</button>
        <span className="sched-week-label">{formatWeekLabel(start, end)}</span>
        <button className="btn-nav" onClick={() => setWeekOffset(o => o + 1)}>›</button>
      </div>

      {grouped.length === 0 ? (
        <p className="sched-empty">{loadingRffm ? 'Cargando…' : 'Sin partidos esta semana'}</p>
      ) : (
        grouped.map(group => (
          <div key={group.dateStr}>
            <div className="date-group-header" style={{ cursor: 'default' }}>
              {formatDayLabel(group.dateStr)}
            </div>
            {group.items.map(({ m, comp }, i) => (
              <MatchRow
                key={`${comp}-${m.matchId ?? i}`}
                m={m}
                comp={comp}
                onClick={() => handleMatchClick(m, comp)}
              />
            ))}
          </div>
        ))
      )}

      {selectedMatch?.comp === 'primera' && (
        <MatchDetailModalLaliga
          match={selectedMatch.match}
          detail={laliga.detail}
          stats={laliga.stats}
          lineups={laliga.lineups}
          incidents={laliga.incidents}
          loading={laliga.loading}
          error={laliga.error}
          onClose={handleClose}
        />
      )}
      {selectedMatch?.comp === 'segunda' && (
        <MatchDetailModal
          detail={segunda.detail}
          stats={segunda.stats}
          lineups={segunda.lineups}
          incidents={segunda.incidents}
          loading={segunda.loading}
          error={segunda.error}
          onClose={handleClose}
        />
      )}
      {selectedMatch?.comp === 'juvenil' && (
        <MatchDetailModalRffm
          match={selectedMatch.match}
          detail={rffm.detail}
          lineups={rffm.lineups}
          incidents={rffm.incidents}
          referees={rffm.referees}
          loading={rffm.loading}
          error={rffm.error}
          onClose={handleClose}
        />
      )}
    </div>
  );
}
