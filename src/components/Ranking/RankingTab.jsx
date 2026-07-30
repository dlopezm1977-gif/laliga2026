import { useState, useEffect } from 'react';
import { getAllUsersAllPredictions, getAllMonthlyResults } from '../../lib/firestore';
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

function computeScore(userPreds, monthlyPreds, matchdayData, monthlyResults) {
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
      const resultTeam = val?.team ?? val ?? null;
      const userTeam = pred?.[cat.key] ?? null;
      if (resultTeam && userTeam && userTeam === resultTeam) mPts += 10;
    });
    if (mPts > 0) byMonth[key] = { points: mPts };
    totalPoints += mPts;
  });

  return { totalPoints, exactCount, signCount, byMatchday, byMonth };
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
            const resultTeam = val?.team ?? val ?? null;
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
                    <span className="teams-text">{m.homeTeam} – {m.awayTeam}</span>
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

function RankingRow({ entry, position, isOpen, onToggle, matchdayData, monthlyResults }) {
  const { username, totalPoints, byMatchday, byMonth, preds, monthlyPreds } = entry;
  const hasDetail = (byMatchday && Object.keys(byMatchday).length > 0) ||
                    (byMonth    && Object.keys(byMonth).length    > 0);

  return (
    <>
      <div className="ranking-row" onClick={onToggle}>
        <span className={`rank-pos ${posClass(position)}`}>
          {MEDALS[position] || position + 1}
        </span>
        <div className="rank-avatar">{initials(username)}</div>
        <div className="rank-name">{username}</div>
        <div className="rank-pts">{totalPoints}</div>
      </div>
      {isOpen && hasDetail && (
        <div className="rank-detail">
          {byMonth && Object.entries(byMonth).sort(([a],[b]) => a.localeCompare(b)).map(([key, stats]) => (
            <RankingMonth
              key={key}
              monthKey={key}
              result={monthlyResults?.[key]}
              pred={monthlyPreds?.[key]}
              points={stats.points}
            />
          ))}
          {byMatchday && Object.entries(byMatchday)
            .sort(([a], [b]) => Number(b) - Number(a))
            .map(([md, s]) => (
              <RankingJornada
                key={md}
                matchday={md}
                predData={preds?.[md]}
                mdMatches={matchdayData[Number(md)]}
                stats={s}
              />
            ))}
        </div>
      )}
    </>
  );
}

export default function RankingTab() {
  const { matchdayData, loading: matchLoading } = useMatches();
  const [scores, setScores]             = useState([]);
  const [monthlyResults, setMonthlyResults] = useState({});
  const [loading, setLoading]           = useState(true);
  const [openUid, setOpenUid]           = useState(null);

  useEffect(() => {
    Promise.all([
      getAllUsersAllPredictions(),
      getAllMonthlyResults(),
    ]).then(([users, mResults]) => {
      setMonthlyResults(mResults || {});
      const computed = users
        .map(u => ({
          uid: u.uid,
          username: u.username,
          preds: u.preds,
          monthlyPreds: u.monthlyPreds,
          ...computeScore(u.preds, u.monthlyPreds, matchdayData, mResults),
        }))
        .filter(u => u.totalPoints > 0 || Object.keys(u.byMatchday).length > 0)
        .sort((a, b) => b.totalPoints - a.totalPoints);
      setScores(computed);
    }).finally(() => setLoading(false));
  }, [matchdayData]);

  if (loading || matchLoading) return <LoadingSpinner text="Cargando ranking…" />;

  if (scores.length === 0) {
    return (
      <div className="empty-state">
        <img src={`${import.meta.env.BASE_URL}icon-empty.png`} alt="" className="empty-icon" />
        <p>Aún no hay puntuaciones.<br />Empieza en cuanto terminen los primeros partidos.</p>
      </div>
    );
  }

  return (
    <>
      <div style={{ marginBottom: '1rem' }}>
        <h2 style={{ fontFamily: 'var(--display)', fontSize: '1.3rem', color: 'var(--accent)', letterSpacing: '.06em' }}>
          Clasificación
        </h2>
        <p style={{ fontSize: '.72rem', color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
          Exacto: 3 pts · Signo: 1 pt · Favorito: ×2 · Toca una fila para ver el detalle
        </p>
      </div>
      {scores.map((entry, i) => (
        <RankingRow
          key={entry.uid}
          entry={entry}
          position={i}
          matchdayData={matchdayData}
          matchdayData={matchdayData}
          monthlyResults={monthlyResults}
          isOpen={openUid === entry.uid}
          onToggle={() => setOpenUid(openUid === entry.uid ? null : entry.uid)}
        />
      ))}
    </>
  );
}
