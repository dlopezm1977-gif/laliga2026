import { useMemo, useState } from 'react';
import { useMatchesRffm } from '../../hooks/useMatchesRffm';
import { useMatchesMunicipal } from '../../hooks/useMatchesMunicipal';
import { useMatchDetailLaliga } from '../../hooks/useMatchDetailLaliga';
import { useMatchDetailSegunda } from '../../hooks/useMatchDetailSegunda';
import { useMatchDetailRffm } from '../../hooks/useMatchDetailRffm';
import { crestUrl, crestUrlSegunda, crestUrlRffm, crestUrlMunicipal, crestUrlMunicipalFallback } from '../../lib/crests';
import { shortName as rffmShortName } from '../../lib/rffmTeams';
import { canonicalize } from '../../lib/segundaTeams';
import MatchDetailModalLaliga from '../Calendar/MatchDetailModalLaliga';
import MatchDetailModal from '../Segunda/MatchDetailModal';
import MatchDetailModalRffm from '../Rffm/MatchDetailModalRffm';
import MatchDetailModalMunicipal from '../Municipal/MatchDetailModalMunicipal';

const CANAL = 'S.A.D. OCIO Y DEPORTE CANAL A';
const MUNICIPAL_TEAM = 'ASTON BIRRA';
const LIVE_STATUSES = new Set(['live', 'in_progress', 'halftime', '1st_half', '2nd_half', 'extra_time', 'penalties']);

const COMP_BADGE = {
  primera:   { label: 'LaLiga',  color: '#ee3524' },
  segunda:   { label: '2ª Div.', color: '#00c4b4' },
  juvenil:   { label: 'Juv.',    color: '#f59e0b' },
  municipal: { label: 'JDM',     color: '#0055A0' },
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
  if (comp === 'juvenil' || comp === 'municipal') return m.fecha?.slice(0, 10) ?? null;
  return m.utcDate ? madridStr(new Date(m.utcDate)) : null;
}

function getMatchTimestamp(m, comp) {
  if (comp === 'juvenil' || comp === 'municipal') {
    if (!m.fecha) return null;
    return new Date(m.fecha.includes('T') ? m.fecha : `${m.fecha}T00:00`).getTime();
  }
  return m.utcDate ? new Date(m.utcDate).getTime() : null;
}

function dateToWeekOffset(dateStr) {
  const now = new Date();
  const day = now.getDay();
  const diffToTuesday = -((day - 2 + 7) % 7);
  const thisTuesday = new Date(now);
  thisTuesday.setDate(now.getDate() + diffToTuesday);
  thisTuesday.setHours(0, 0, 0, 0);
  const [y, mo, d] = dateStr.split('-').map(Number);
  const target = new Date(y, mo - 1, d);
  target.setHours(0, 0, 0, 0);
  return Math.floor((target - thisTuesday) / (7 * 24 * 60 * 60 * 1000));
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
  if (comp === 'municipal') {
    if (m.status === 'finished') return 'finished';
    return 'scheduled';
  }
  if (LIVE_STATUSES.has(m.status)) return 'live';
  if (m.status === 'finished') return 'finished';
  return 'scheduled';
}

function getTime(m, comp) {
  if (comp === 'juvenil' || comp === 'municipal') return m.hora || null;
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

  let homeName, awayName, homeCrest, awayCrest, homeCrestErr, awayCrestErr;
  if (comp === 'primera') {
    homeName = m.homeTeam; awayName = m.awayTeam;
    homeCrest = crestUrl(m.homeTeam); awayCrest = crestUrl(m.awayTeam);
  } else if (comp === 'segunda') {
    homeName = canonicalize(m.homeTeam); awayName = canonicalize(m.awayTeam);
    homeCrest = crestUrlSegunda(homeName); awayCrest = crestUrlSegunda(awayName);
  } else if (comp === 'municipal') {
    homeName = m.homeTeam; awayName = m.awayTeam;
    homeCrest = crestUrlMunicipal(m.homeTeam); awayCrest = crestUrlMunicipal(m.awayTeam);
    homeCrestErr = e => { e.target.onerror = null; e.target.src = crestUrlMunicipalFallback(m.homeTeam); };
    awayCrestErr = e => { e.target.onerror = null; e.target.src = crestUrlMunicipalFallback(m.awayTeam); };
  } else {
    homeName = rffmShortName(m.homeTeam); awayName = rffmShortName(m.awayTeam);
    homeCrest = crestUrlRffm(m.homeLogo); awayCrest = crestUrlRffm(m.awayLogo);
  }

  return (
    <div className={`sched-row${onClick ? ' sched-row--clickable' : ''}`} onClick={onClick}>
      <div className="sched-row-meta">
        <span className="sched-comp-badge" style={{ '--badge-color': badge.color }}>{badge.label}</span>
        {time && <span className="sched-time">{time}</span>}
        {isLive && <span className="sched-live">En vivo</span>}
      </div>
      <div className="sched-teams">
        <div className="sched-team sched-team--home">
          <span className="sched-name">{homeName}</span>
          <img className="sched-crest" src={homeCrest} alt={homeName} onError={homeCrestErr} />
        </div>
        <div className="sched-score-col">
          {(isFinished || isLive)
            ? <span className="sched-score">{m.homeScore ?? '–'} – {m.awayScore ?? '–'}</span>
            : <span className="sched-vs">vs</span>}
        </div>
        <div className="sched-team sched-team--away">
          <img className="sched-crest" src={awayCrest} alt={awayName} onError={awayCrestErr} />
          <span className="sched-name">{awayName}</span>
        </div>
      </div>
    </div>
  );
}

const DAY_HEADERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function buildCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDate = new Date(year, month + 1, 0).getDate();
  const startDow = (firstDay.getDay() + 6) % 7; // Mon=0 … Sun=6
  const days = [];
  for (let i = 0; i < startDow; i++) days.push(null);
  for (let d = 1; d <= lastDate; d++) {
    days.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

function MiniCalendar({ year, month, onPrevMonth, onNextMonth, matchDates, onSelectDay, weekStart, weekEnd }) {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  const weekStartStr = madridStr(weekStart);
  const weekEndStr   = madridStr(weekEnd);
  const days = buildCalendarDays(year, month);
  const monthLabel = new Date(year, month, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

  return (
    <div className="mini-cal">
      <div className="mini-cal-header">
        <button className="btn-nav" onClick={onPrevMonth}>‹</button>
        <span className="mini-cal-month">{monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}</span>
        <button className="btn-nav" onClick={onNextMonth}>›</button>
      </div>
      <div className="mini-cal-grid">
        {DAY_HEADERS.map(h => <div key={h} className="mini-cal-dow">{h}</div>)}
        {days.map((ds, i) => {
          if (!ds) return <div key={`e${i}`} className="mini-cal-empty" />;
          const comps = matchDates[ds];
          const d = parseInt(ds.slice(8), 10);
          const cls = [
            'mini-cal-day',
            ds === today          ? 'mini-cal-day--today'   : '',
            ds >= weekStartStr && ds <= weekEndStr ? 'mini-cal-day--in-week' : '',
          ].filter(Boolean).join(' ');
          return (
            <div key={ds} className={cls} onClick={() => onSelectDay(ds)}>
              <span className="mini-cal-num">{d}</span>
              {comps && (
                <div className="mini-cal-dots">
                  {[...comps].map(c => (
                    <span key={c} className="mini-cal-dot" style={{ background: COMP_BADGE[c].color }} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function MySchedule({ matchdayData, roundDataSegunda, favoriteTeam, favoriteTeamSegunda, showTitle = true }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedMatch, setSelectedMatch] = useState(null); // { match, comp }
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() });

  const { roundData: roundDataRffm, loading: loadingRffm } = useMatchesRffm();
  const { roundData: roundDataMunicipal, loading: loadingMunicipal } = useMatchesMunicipal();
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

    Object.values(roundDataMunicipal).flat().forEach(m => {
      if (m.homeTeam !== MUNICIPAL_TEAM && m.awayTeam !== MUNICIPAL_TEAM) return;
      const dateStr = getMatchDateStr(m, 'municipal');
      if (!dateStr || dateStr < startStr || dateStr > endStr) return;
      all.push({ m, comp: 'municipal', dateStr, ts: getMatchTimestamp(m, 'municipal') ?? 0 });
    });

    all.sort((a, b) => a.dateStr !== b.dateStr ? a.dateStr.localeCompare(b.dateStr) : a.ts - b.ts);

    const groups = [];
    for (const item of all) {
      const last = groups[groups.length - 1];
      if (last && last.dateStr === item.dateStr) last.items.push(item);
      else groups.push({ dateStr: item.dateStr, items: [item] });
    }
    return groups;
  }, [start, end, matchdayData, roundDataSegunda, roundDataRffm, roundDataMunicipal, favoriteTeam, favoriteTeamSegunda]);

  const matchDates = useMemo(() => {
    const map = {};
    const add = (ds, comp) => {
      if (!ds) return;
      if (!map[ds]) map[ds] = new Set();
      map[ds].add(comp);
    };
    if (favoriteTeam)
      Object.values(matchdayData).flat().forEach(m => {
        if (m.homeTeam !== favoriteTeam && m.awayTeam !== favoriteTeam) return;
        add(getMatchDateStr(m, 'primera'), 'primera');
      });
    if (favoriteTeamSegunda)
      Object.values(roundDataSegunda).flat().forEach(m => {
        const home = canonicalize(m.homeTeam), away = canonicalize(m.awayTeam);
        if (home !== favoriteTeamSegunda && away !== favoriteTeamSegunda) return;
        add(getMatchDateStr(m, 'segunda'), 'segunda');
      });
    Object.values(roundDataRffm).flat().forEach(m => {
      if (m.homeTeam !== CANAL && m.awayTeam !== CANAL) return;
      add(getMatchDateStr(m, 'juvenil'), 'juvenil');
    });
    Object.values(roundDataMunicipal).flat().forEach(m => {
      if (m.homeTeam !== MUNICIPAL_TEAM && m.awayTeam !== MUNICIPAL_TEAM) return;
      add(getMatchDateStr(m, 'municipal'), 'municipal');
    });
    return map;
  }, [matchdayData, roundDataSegunda, roundDataRffm, roundDataMunicipal, favoriteTeam, favoriteTeamSegunda]);

  function handleMatchClick(m, comp) {
    setSelectedMatch({ match: m, comp });
    if (comp === 'primera') laliga.open(m.matchId);
    else if (comp === 'segunda') segunda.open(m.matchId);
    else if (comp === 'juvenil') rffm.open(m.matchId);
    // municipal: no external hook, modal shows directly from selectedMatch
  }

  function toggleCalendar() {
    if (!calendarOpen) setCalendarMonth({ year: start.getFullYear(), month: start.getMonth() });
    setCalendarOpen(v => !v);
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
        {showTitle && <span className="modal-label">Mis partidos</span>}
        {weekOffset !== 0 && (
          <button className="sched-today-btn" onClick={() => setWeekOffset(0)}>Hoy</button>
        )}
      </div>
      <div className="sched-nav">
        <button className="btn-nav" onClick={() => setWeekOffset(o => o - 1)}>‹</button>
        <button className={`sched-week-label sched-week-label--btn${calendarOpen ? ' active' : ''}`} onClick={toggleCalendar}>
          {formatWeekLabel(start, end)}
        </button>
        <button className="btn-nav" onClick={() => setWeekOffset(o => o + 1)}>›</button>
      </div>

      {calendarOpen && (
        <MiniCalendar
          year={calendarMonth.year}
          month={calendarMonth.month}
          onPrevMonth={() => setCalendarMonth(({ year, month }) =>
            month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }
          )}
          onNextMonth={() => setCalendarMonth(({ year, month }) =>
            month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }
          )}
          matchDates={matchDates}
          onSelectDay={ds => { setWeekOffset(dateToWeekOffset(ds)); setCalendarOpen(false); }}
          weekStart={start}
          weekEnd={end}
        />
      )}

      {grouped.length === 0 ? (
        <p className="sched-empty">{(loadingRffm || loadingMunicipal) ? 'Cargando…' : 'Sin partidos esta semana'}</p>
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
      {selectedMatch?.comp === 'municipal' && (
        <MatchDetailModalMunicipal
          match={selectedMatch.match}
          onClose={handleClose}
        />
      )}
    </div>
  );
}
