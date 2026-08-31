import { useState, useEffect, useMemo } from 'react';
import { getAllUsersAllPredictions, getAllMonthlyResults, getAllUsersMinigameResults, getAllMinigameConfigs } from '../../lib/firestore';
import SeasonPredCard from '../Season/SeasonPredCard';
import { useMatches } from '../../hooks/useMatches';
import { MONTHLY_CATEGORIES, SEASON_MONTHS } from '../../lib/months';
import { crestUrl, teamAbbr } from '../../lib/crests';
import LoadingSpinner from '../LoadingSpinner';

function initials(name) {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

const MEDALS = ['🥇', '🥈', '🥉'];

function posClass(i) {
  if (i === 0) return 'gold';
  if (i === 1) return 'silver';
  if (i === 2) return 'bronze';
  return '';
}

function getSign(h, a) {
  if (h > a) return 'H';
  if (a > h) return 'A';
  return 'D';
}

function resultBadge(pred, real, isFavorite) {
  if (real.homeScore === null || real.awayScore === null) return null;
  if (pred.homeScore === real.homeScore && pred.awayScore === real.awayScore)
    return isFavorite ? { pts: 6, cls: 'exact fav', label: '⭐ Exacto' } : { pts: 3, cls: 'exact', label: 'Exacto' };
  if (getSign(pred.homeScore, pred.awayScore) === getSign(real.homeScore, real.awayScore))
    return isFavorite ? { pts: 2, cls: 'sign fav', label: '⭐ Signo' } : { pts: 1, cls: 'sign', label: 'Signo' };
  return { pts: 0, cls: 'miss', label: 'Fallo' };
}

function computeScore(userPreds, monthlyPreds, matchdayData, monthlyResults, minigameResults, minigameConfigs) {
  let totalPoints = 0, exactCount = 0, signCount = 0;
  const byMatchday = {};

  Object.entries(userPreds).forEach(([md, predData]) => {
    const mdMatches = matchdayData[Number(md)] || [];
    const favoriteTeam = predData?.favoriteTeam || null;
    const predMap = {};
    (predData?.matches || []).forEach(p => { predMap[p.matchId] = p; });

    let jPts = 0, jExact = 0, jSign = 0, jFav = 0, jFallo = 0;
    mdMatches.forEach(m => {
      const pred = predMap[m.matchId];
      if (!pred || m.homeScore === null || m.awayScore === null) return;
      const isFav = !!favoriteTeam && (m.homeTeam === favoriteTeam || m.awayTeam === favoriteTeam);
      const b = resultBadge(pred, m, isFav);
      if (!b) return;
      jPts += b.pts;
      if (b.cls.includes('exact')) jExact++;
      else if (b.cls.includes('sign')) jSign++;
      else jFallo++;
      if (isFav && b.pts > 0) jFav += b.pts - (b.cls.includes('exact') ? 3 : 1);
    });

    if (jExact > 0 || jSign > 0 || jFallo > 0 || jPts > 0) {
      byMatchday[md] = { points: jPts, exact: jExact, sign: jSign, fallo: jFallo, favoriteBonus: jFav };
    }
    totalPoints += jPts;
    exactCount  += jExact;
    signCount   += jSign;
  });

  const byMonth = {};
  Object.entries(monthlyPreds || {}).forEach(([key, pred]) => {
    const result = monthlyResults[key];
    if (!result) return;
    let mPts = 0;
    MONTHLY_CATEGORIES.forEach(cat => {
      const val = result[cat.key];
      const resultTeam = typeof val === 'string' ? val : (val?.team ?? null);
      const userTeam = pred?.[cat.key] ?? null;
      if (resultTeam && userTeam && userTeam === resultTeam) mPts += 10;
    });
    const hasAnyResult = MONTHLY_CATEGORIES.some(cat => {
      const val = result[cat.key];
      return (typeof val === 'string' ? val : (val?.team ?? null)) !== null;
    });
    if (!hasAnyResult) return;
    byMonth[key] = { points: mPts };
    totalPoints += mPts;
  });

  const byMinigame = {};
  const now = Date.now();
  Object.entries(minigameConfigs || {}).forEach(([gameId, game]) => {
    const ended = (game.endDate?.toMillis?.() ?? 0) < now;
    const result = (minigameResults || {})[gameId];
    if (result?.started) {
      byMinigame[gameId] = { points: result.points ?? 0, completed: result.completed ?? false, title: game.title };
      totalPoints += result.points ?? 0;
    } else if (ended) {
      byMinigame[gameId] = { points: 0, completed: false, title: game.title, missed: true };
    }
  });

  return { totalPoints, exactCount, signCount, byMatchday, byMonth, byMinigame };
}

function RankingMonth({ monthKey, result, pred, points }) {
  const [open, setOpen] = useState(false);
  const label = SEASON_MONTHS.find(m => m.key === monthKey)?.label ?? monthKey;

  return (
    <div>
      <div
        className="rank-detail-row"
        onClick={() => setOpen(o => !o)}
        style={{ cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span><span className="monthly-badge">mensual</span></span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
          <span className="j-pts" style={{ fontSize: '.95rem' }}>{points} pts</span>
          <span style={{ color: 'var(--muted)', fontSize: '.7rem' }}>{open ? '▲' : '▼'}</span>
        </span>
      </div>
      {open && (
        <div style={{ padding: '.15rem .2rem .3rem', borderBottom: '1px solid var(--border)' }}>
          <div className="history-col-headers">
            <span /><span>Pred</span><span>Real</span><span />
          </div>
          {MONTHLY_CATEGORIES.map(cat => {
            const val        = result?.[cat.key];
            const resultTeam = typeof val === 'string' ? val : (val?.team ?? null);
            const userTeam   = pred?.[cat.key] ?? null;
            const correct    = resultTeam && userTeam && userTeam === resultTeam;
            const missed     = resultTeam && userTeam && userTeam !== resultTeam;
            return (
              <div className="history-match-row" key={cat.key}>
                <span className="teams">
                  <span className="teams-text" style={{ color: 'var(--muted)' }}>{cat.emoji} {cat.label}</span>
                </span>
                <span className="pred">
                  {userTeam
                    ? <><img className="team-crest team-crest--sm" src={crestUrl(userTeam)} alt={userTeam} /> {teamAbbr(userTeam)}</>
                    : '–'}
                </span>
                <span className={`real${resultTeam ? ' real--done' : ''}`}>
                  {resultTeam
                    ? <><img className="team-crest team-crest--sm" src={crestUrl(resultTeam)} alt={resultTeam} /> {teamAbbr(resultTeam)}</>
                    : '?'}
                </span>
                {correct && <span className="result-badge exact">+10 pts</span>}
                {missed  && <span className="result-badge miss">0</span>}
                {!resultTeam && <span className="result-badge miss" style={{ opacity: .4 }}>–</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RankingJornada({ matchday, predData, mdMatches, stats }) {
  const [open, setOpen] = useState(false);
  const matches      = mdMatches || [];
  const preds        = predData?.matches || [];
  const favoriteTeam = predData?.favoriteTeam || null;
  const s            = stats || {};

  const predMap = {};
  preds.forEach(p => { predMap[p.matchId] = p; });

  return (
    <div>
      <div
        className="rank-detail-row"
        onClick={() => setOpen(o => !o)}
        style={{ cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ fontWeight: 600 }}>Jornada {matchday}</span>
        <span style={{ display: 'flex', gap: '.3rem', alignItems: 'center' }}>
          <span className="j-stat j-stat--exact">{s.exact ?? 0} ✓</span>
          <span className="j-stat j-stat--sign">{s.sign ?? 0} ≈</span>
          <span className="j-stat j-stat--miss">{s.fallo ?? 0} ✗</span>
          {s.favoriteBonus > 0 && <span style={{ color: '#f59e0b', fontSize: '.65rem' }}>⭐+{s.favoriteBonus}</span>}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
          <span className="j-pts" style={{ fontSize: '.95rem' }}>{s.points ?? 0} pts</span>
          <span style={{ color: 'var(--muted)', fontSize: '.7rem' }}>{open ? '▲' : '▼'}</span>
        </span>
      </div>
      {open && (
        <div style={{ padding: '.15rem .2rem .3rem', borderBottom: '1px solid var(--border)' }}>
          {favoriteTeam && (
            <p style={{ fontSize: '.68rem', color: '#f59e0b', fontFamily: 'var(--mono)', margin: '.2rem 0 .3rem' }}>
              ⭐ Favorito: {favoriteTeam}
            </p>
          )}
          <div className="history-col-headers">
            <span /><span>Pred</span><span>Real</span><span />
          </div>
          {matches
            .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate))
            .map(m => {
              const pred = predMap[m.matchId];
              const isFavorite = !!favoriteTeam && (m.homeTeam === favoriteTeam || m.awayTeam === favoriteTeam);
              const badge = pred ? resultBadge(pred, m, isFavorite) : null;
              const hasResult = m.homeScore !== null && m.awayScore !== null;
              return (
                <div className="history-match-row" key={m.matchId}>
                  <span className="teams">
                    <img className="team-crest team-crest--sm" src={crestUrl(m.homeTeam)} alt={m.homeTeam} />
                    <span className="teams-text">
                      <span className="team-full">{m.homeTeam} – {m.awayTeam}</span>
                      <span className="team-abbr">{teamAbbr(m.homeTeam)} – {teamAbbr(m.awayTeam)}</span>
                    </span>
                    <img className="team-crest team-crest--sm" src={crestUrl(m.awayTeam)} alt={m.awayTeam} />
                  </span>
                  <span className="pred">{pred ? `${pred.homeScore}:${pred.awayScore}` : '–'}</span>
                  <span className={`real${hasResult ? ' real--done' : ''}`}>
                    {hasResult ? `${m.homeScore}:${m.awayScore}` : '?'}
                  </span>
                  {badge ? (
                    <span className={`result-badge ${badge.cls}`}>
                      {badge.label} {badge.pts > 0 ? `+${badge.pts}` : '0'}
                    </span>
                  ) : (
                    <span className="result-badge miss">–</span>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

function RankingMinigame({ stats }) {
  const [open, setOpen] = useState(false);
  const { points, completed, title, missed } = stats;
  const badgeCls = completed ? 'badge-green-sm' : missed ? 'badge-red-sm' : 'badge-orange-sm';
  const label    = completed ? '✅ Completado' : missed ? '❌ No jugado' : '⏰ Intentado';
  return (
    <div>
      <div
        className="rank-detail-row"
        onClick={() => setOpen(o => !o)}
        style={{ cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ fontWeight: 600 }}>{title || 'Juego de Parejas'}</span>
        <span><span className="game-badge">🎮 juego</span></span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
          <span className="j-pts" style={{ fontSize: '.95rem' }}>{points} pts</span>
          <span style={{ color: 'var(--muted)', fontSize: '.7rem' }}>{open ? '▲' : '▼'}</span>
        </span>
      </div>
      {open && (
        <div style={{ padding: '.3rem .2rem .4rem', borderBottom: '1px solid var(--border)', fontSize: '.8rem', color: 'var(--muted)' }}>
          {label}
        </div>
      )}
    </div>
  );
}

function RankingRow({ entry, position, isOpen, onToggle, matchdayData, monthlyResults }) {
  const { username, avatar, totalPoints, byMatchday, byMonth, byMinigame, preds, monthlyPreds, seasonPred } = entry;
  const hasPreds = Object.keys(preds || {}).length > 0 || Object.keys(monthlyPreds || {}).length > 0;

  return (
    <>
      <div className="ranking-row" onClick={onToggle}>
        <span className={`rank-pos ${posClass(position)}`}>
          {MEDALS[position] || position + 1}
        </span>
        <div className="rank-avatar">
          {avatar
            ? <img src={`${import.meta.env.BASE_URL}avatars/${avatar}`} alt={username} />
            : initials(username)
          }
        </div>
        <div className="rank-name">{username}</div>
        <div className="rank-pts">{totalPoints}</div>
      </div>
      {isOpen && (
        <div className="rank-detail">
          <SeasonPredCard pred={seasonPred} variant="ranking" />
          {!hasPreds && (
            <p style={{ color: 'var(--muted)', fontSize: '.8rem', padding: '.5rem .2rem', fontFamily: 'var(--mono)', margin: 0 }}>
              Sin predicciones todavía.
            </p>
          )}
          {Object.entries(byMinigame || {}).map(([gameId, stats]) => (
            <RankingMinigame key={gameId} stats={stats} />
          ))}
          {Object.keys(monthlyPreds || {})
            .sort((a, b) => {
              const ai = SEASON_MONTHS.findIndex(m => m.key === a);
              const bi = SEASON_MONTHS.findIndex(m => m.key === b);
              return (bi === -1 ? 999 : bi) - (ai === -1 ? 999 : ai);
            })
            .map(key => (
            <RankingMonth
              key={key}
              monthKey={key}
              result={monthlyResults?.[key]}
              pred={monthlyPreds?.[key]}
              points={byMonth?.[key]?.points ?? 0}
            />
          ))}
          {Object.keys(preds || {})
            .sort((a, b) => Number(b) - Number(a))
            .map(md => (
              <RankingJornada
                key={md}
                matchday={md}
                predData={preds?.[md]}
                mdMatches={matchdayData[Number(md)]}
                stats={byMatchday?.[md]}
              />
            ))}
        </div>
      )}
    </>
  );
}

function PartialRankingRow({ entry, position, points, isOpen, onToggle, matchdayData, monthlyResults, filterMds, filterMonth }) {
  const { username, avatar, preds, monthlyPreds, byMatchday, byMonth } = entry;
  const hasPreds = filterMds.some(md => preds?.[md]) || (filterMonth && monthlyPreds?.[filterMonth]);

  return (
    <>
      <div className="ranking-row" onClick={onToggle}>
        <span className={`rank-pos ${posClass(position)}`}>
          {MEDALS[position] || position + 1}
        </span>
        <div className="rank-avatar">
          {avatar
            ? <img src={`${import.meta.env.BASE_URL}avatars/${avatar}`} alt={username} />
            : initials(username)
          }
        </div>
        <div className="rank-name">{username}</div>
        <div className="rank-pts">{points}</div>
      </div>
      {isOpen && (
        <div className="rank-detail">
          {!hasPreds && (
            <p style={{ color: 'var(--muted)', fontSize: '.8rem', padding: '.5rem .2rem', fontFamily: 'var(--mono)', margin: 0 }}>
              Sin predicciones para este período.
            </p>
          )}
          {filterMonth && monthlyPreds?.[filterMonth] && (
            <RankingMonth
              monthKey={filterMonth}
              result={monthlyResults?.[filterMonth]}
              pred={monthlyPreds[filterMonth]}
              points={byMonth?.[filterMonth]?.points ?? 0}
            />
          )}
          {filterMds
            .slice()
            .sort((a, b) => Number(b) - Number(a))
            .map(md => (
              <RankingJornada
                key={md}
                matchday={md}
                predData={preds?.[md]}
                mdMatches={matchdayData[Number(md)]}
                stats={byMatchday?.[md]}
              />
            ))
          }
        </div>
      )}
    </>
  );
}

const pillStyle = (active) => ({
  padding: '.3rem .75rem',
  borderRadius: '99px',
  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
  background: active ? 'var(--accent)' : 'transparent',
  color: active ? '#fff' : 'var(--text)',
  cursor: 'pointer',
  fontSize: '.8rem',
  fontFamily: 'var(--mono)',
  fontWeight: active ? 700 : 400,
});

const selectStyle = {
  marginTop: '.5rem',
  padding: '.3rem .5rem',
  borderRadius: '6px',
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontSize: '.85rem',
  fontFamily: 'var(--mono)',
};

export default function RankingTab() {
  const { matchdayData, currentMatchday, loading: matchLoading } = useMatches();
  const [scores, setScores]               = useState([]);
  const [monthlyResults, setMonthlyResults] = useState({});
  const [loading, setLoading]             = useState(true);
  const [openUid, setOpenUid]             = useState(null);
  const [view, setView]                   = useState('global');
  const [selectedMd, setSelectedMd]       = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);

  useEffect(() => {
    Promise.all([
      getAllUsersAllPredictions(),
      getAllMonthlyResults(),
      getAllUsersMinigameResults(),
      getAllMinigameConfigs(),
    ]).then(([users, mResults, mgResults, mgConfigs]) => {
      setMonthlyResults(mResults || {});
      const computed = users
        .map(u => ({
          uid: u.uid,
          username: u.username,
          avatar: u.avatar,
          preds: u.preds,
          monthlyPreds: u.monthlyPreds,
          seasonPred: u.seasonPred,
          minigameResults: mgResults[u.uid] || {},
          ...computeScore(u.preds, u.monthlyPreds, matchdayData, mResults, mgResults[u.uid] || {}, mgConfigs),
        }))
        .sort((a, b) => b.totalPoints - a.totalPoints || (a.username || '').localeCompare(b.username || '', 'es'));
      setScores(computed);
    }).finally(() => setLoading(false));
  }, [matchdayData]);

  // Mapping matchday number → month key using match dates
  const matchdayToMonth = useMemo(() => {
    const mapping = {};
    Object.entries(matchdayData).forEach(([md, matches]) => {
      if (!matches?.length) return;
      const earliest = matches.reduce((min, m) => m.utcDate < min ? m.utcDate : min, matches[0].utcDate);
      const date = new Date(earliest);
      const y = date.getFullYear();
      const m = date.getMonth() + 1;
      const monthDef = SEASON_MONTHS.find(sm => sm.year === y && sm.month === m);
      if (monthDef) mapping[md] = monthDef.key;
    });
    return mapping;
  }, [matchdayData]);

  // All 38 matchdays, most recent first for the selector
  const availableMatchdays = useMemo(() => {
    return Array.from({ length: 38 }, (_, i) => i + 1);
  }, []);

  // Months that have at least one matchday with data or a monthly result
  const availableMonths = useMemo(() => {
    const monthsWithData = new Set(Object.values(matchdayToMonth));
    Object.keys(monthlyResults).forEach(k => monthsWithData.add(k));
    return SEASON_MONTHS.filter(m => monthsWithData.has(m.key));
  }, [matchdayToMonth, monthlyResults]);

  // Auto-select current matchday (same logic as calendar)
  useEffect(() => {
    if (currentMatchday) setSelectedMd(String(currentMatchday));
  }, [currentMatchday]);

  // Auto-select the month that corresponds to the current matchday
  useEffect(() => {
    if (!currentMatchday || !Object.keys(matchdayToMonth).length || !availableMonths.length) return;
    const key = matchdayToMonth[String(currentMatchday)];
    if (key && availableMonths.some(m => m.key === key)) {
      setSelectedMonth(key);
    } else {
      setSelectedMonth(availableMonths[availableMonths.length - 1].key);
    }
  }, [currentMatchday, matchdayToMonth, availableMonths]);

  // Sorted scores for the current view
  const displayedScores = useMemo(() => {
    if (view === 'global') return scores;

    if (view === 'jornada' && selectedMd) {
      return [...scores]
        .map(s => ({ ...s, displayPoints: s.byMatchday?.[selectedMd]?.points ?? 0 }))
        .sort((a, b) => b.displayPoints - a.displayPoints || (a.username || '').localeCompare(b.username || '', 'es'));
    }

    if (view === 'mes' && selectedMonth) {
      const mdsInMonth = Object.entries(matchdayToMonth)
        .filter(([, key]) => key === selectedMonth)
        .map(([md]) => md);
      return [...scores]
        .map(s => ({
          ...s,
          displayPoints:
            mdsInMonth.reduce((sum, md) => sum + (s.byMatchday?.[md]?.points ?? 0), 0)
            + (s.byMonth?.[selectedMonth]?.points ?? 0),
        }))
        .sort((a, b) => b.displayPoints - a.displayPoints || (a.username || '').localeCompare(b.username || '', 'es'));
    }

    return scores;
  }, [view, selectedMd, selectedMonth, scores, matchdayToMonth]);

  // Matchdays visible en la vista parcial actual
  const filterMds = useMemo(() => {
    if (view === 'jornada' && selectedMd) return [selectedMd];
    if (view === 'mes' && selectedMonth) {
      return Object.entries(matchdayToMonth)
        .filter(([, key]) => key === selectedMonth)
        .map(([md]) => md);
    }
    return [];
  }, [view, selectedMd, selectedMonth, matchdayToMonth]);

  const filterMonth = view === 'mes' ? selectedMonth : null;

  if (loading || matchLoading) return <LoadingSpinner text="Cargando ranking…" />;

  const selectedMonthLabel = SEASON_MONTHS.find(m => m.key === selectedMonth)?.label ?? selectedMonth;

  return (
    <>
      <div style={{ marginBottom: '1rem' }}>
        <h2 style={{ fontFamily: 'var(--display)', fontSize: '1.3rem', color: 'var(--accent)', letterSpacing: '.06em' }}>
          Clasificación
        </h2>
        <p style={{ fontSize: '.72rem', color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
          {view === 'global' && 'Exacto: 3 pts · Signo: 1 pt · Favorito: ×2 · Toca una fila para ver el detalle'}
          {view === 'jornada' && selectedMd && `Puntos de la Jornada ${selectedMd}`}
          {view === 'mes' && selectedMonth && `Jornadas + predicción mensual de ${selectedMonthLabel}`}
        </p>

        <div style={{ display: 'flex', gap: '.5rem', marginTop: '.75rem', flexWrap: 'wrap' }}>
          <button style={pillStyle(view === 'global')}  onClick={() => setView('global')}>Global</button>
          <button style={pillStyle(view === 'jornada')} onClick={() => setView('jornada')}>Jornada</button>
          <button style={pillStyle(view === 'mes')}     onClick={() => setView('mes')}>Mes</button>
        </div>

        {view === 'jornada' && availableMatchdays.length > 0 && (
          <select value={selectedMd ?? ''} onChange={e => setSelectedMd(e.target.value)} style={selectStyle}>
            {availableMatchdays.map(md => (
              <option key={md} value={String(md)}>Jornada {md}</option>
            ))}
          </select>
        )}

        {view === 'mes' && availableMonths.length > 0 && (
          <select value={selectedMonth ?? ''} onChange={e => setSelectedMonth(e.target.value)} style={selectStyle}>
            {availableMonths.map(m => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </select>
        )}
      </div>

      {view === 'global'
        ? scores.map((entry, i) => (
            <RankingRow
              key={entry.uid}
              entry={entry}
              position={i}
              matchdayData={matchdayData}
              monthlyResults={monthlyResults}
              isOpen={openUid === entry.uid}
              onToggle={() => setOpenUid(openUid === entry.uid ? null : entry.uid)}
            />
          ))
        : displayedScores.map((entry, i) => (
            <PartialRankingRow
              key={entry.uid}
              entry={entry}
              position={i}
              points={entry.displayPoints}
              isOpen={openUid === entry.uid}
              onToggle={() => setOpenUid(openUid === entry.uid ? null : entry.uid)}
              matchdayData={matchdayData}
              monthlyResults={monthlyResults}
              filterMds={filterMds}
              filterMonth={filterMonth}
            />
          ))
      }
    </>
  );
}
