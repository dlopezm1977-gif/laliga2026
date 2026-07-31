import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { crestUrl, teamAbbr } from '../../lib/crests';
import { getAllPredictions, getAllMonthlyResults, getAllMonthlyPredictionsForUser } from '../../lib/firestore';
import { useMatches } from '../../hooks/useMatches';
import { SEASON_MONTHS, MONTHLY_CATEGORIES } from '../../lib/months';
import LoadingSpinner from '../LoadingSpinner';

function getSign(h, a) {
  if (h > a) return 'H';
  if (a > h) return 'A';
  return 'D';
}

function resultBadge(pred, real, isFavorite) {
  if (real.homeScore === null || real.awayScore === null) return null;
  if (pred.homeScore === real.homeScore && pred.awayScore === real.awayScore) {
    return isFavorite
      ? { label: '⭐ Exacto', cls: 'exact fav', pts: 6 }
      : { label: 'Exacto', cls: 'exact', pts: 3 };
  }
  if (getSign(pred.homeScore, pred.awayScore) === getSign(real.homeScore, real.awayScore)) {
    return isFavorite
      ? { label: '⭐ Signo', cls: 'sign fav', pts: 2 }
      : { label: 'Signo', cls: 'sign', pts: 1 };
  }
  return { label: 'Fallo', cls: 'miss', pts: 0 };
}

function HistoryMonthCard({ month, result, pred }) {
  const [open, setOpen] = useState(false);

  const hasAnyResult = result && (result.bestPlayer || result.bestCoach || result.bestU23);
  if (!hasAnyResult) return null;

  let monthPts = 0;
  MONTHLY_CATEGORIES.forEach(cat => {
    const val = result?.[cat.key];
    const resultTeam = val?.team ?? val ?? null;
    const userTeam = pred?.[cat.key] ?? null;
    if (resultTeam && userTeam && userTeam === resultTeam) monthPts += 10;
  });

  return (
    <div className="history-jornada">
      <div className="history-jornada-hdr" onClick={() => setOpen(o => !o)}>
        <span style={{ fontWeight: 600 }}>{month.label}</span>
        <span className="monthly-badge">mensual</span>
        <span className="j-pts">{monthPts} pts</span>
        <span style={{ color: 'var(--muted)', fontSize: '.8rem' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className="history-jornada-body">
          <div className="history-col-headers">
            <span />
            <span>Pred</span>
            <span>Real</span>
            <span />
          </div>
          {MONTHLY_CATEGORIES.map(cat => {
            const val        = result?.[cat.key];
            const resultTeam = val?.team ?? val ?? null;
            const resultName = val?.name ?? null;
            const userTeam   = pred?.[cat.key] ?? null;
            const correct    = resultTeam && userTeam && userTeam === resultTeam;
            const missed     = resultTeam && userTeam && userTeam !== resultTeam;
            return (
              <div className="history-match-row" key={cat.key} style={{ gap: '.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '.75rem', color: 'var(--muted)', minWidth: '110px' }}>
                  {cat.emoji} {cat.label}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '.25rem', flex: 1 }}>
                  {userTeam
                    ? <><img className="team-crest team-crest--sm" src={crestUrl(userTeam)} alt={userTeam} /><span style={{ fontSize: '.8rem', fontFamily: 'var(--mono)' }}>{teamAbbr(userTeam)}</span></>
                    : <span style={{ color: 'var(--muted)', fontSize: '.75rem' }}>Sin pred.</span>
                  }
                </span>
                {resultTeam && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '.25rem' }}>
                    <img className="team-crest team-crest--sm" src={crestUrl(resultTeam)} alt={resultTeam} />
                    <span style={{ fontSize: '.78rem', fontFamily: 'var(--mono)', color: 'var(--muted)' }}>{teamAbbr(resultTeam)}</span>
                  </span>
                )}
                {correct && <span className="result-badge exact">+10 pts</span>}
                {missed  && <span className="result-badge miss">0 pts</span>}
                {!resultTeam && <span className="result-badge miss" style={{ opacity: .4 }}>–</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function HistoryJornada({ matchday, predData, matchdayData }) {
  const [open, setOpen] = useState(false);
  const matches      = matchdayData || [];
  const preds        = predData?.matches || [];
  const favoriteTeam = predData?.favoriteTeam || null;

  const predMap = {};
  preds.forEach(p => { predMap[p.matchId] = p; });

  let cPts = 0, cExact = 0, cSign = 0, cFallo = 0, hasAnyResult = false;
  matches.forEach(m => {
    const pred = predMap[m.matchId];
    if (!pred || m.homeScore === null || m.awayScore === null) return;
    hasAnyResult = true;
    const isFav = !!favoriteTeam && (m.homeTeam === favoriteTeam || m.awayTeam === favoriteTeam);
    const badge = resultBadge(pred, m, isFav);
    if (badge) {
      cPts += badge.pts;
      if (badge.cls.includes('exact')) cExact++;
      else if (badge.cls.includes('sign')) cSign++;
      else cFallo++;
    }
  });

  const pts   = hasAnyResult ? cPts   : null;
  const exact = hasAnyResult ? cExact : null;
  const sign  = hasAnyResult ? cSign  : null;
  const fallo = hasAnyResult ? cFallo : null;

  return (
    <div className="history-jornada">
      <div className="history-jornada-hdr" onClick={() => setOpen(o => !o)}>
        <span style={{ fontWeight: 600 }}>Jornada {matchday}</span>
        <span style={{ display: 'flex', gap: '.35rem', alignItems: 'center' }}>
          {exact != null ? (
            <>
              <span className="j-stat j-stat--exact">{exact} ✓</span>
              <span className="j-stat j-stat--sign">{sign} ≈</span>
              <span className="j-stat j-stat--miss">{fallo} ✗</span>
            </>
          ) : null}
        </span>
        <span className="j-pts">{pts != null ? pts : '–'} pts</span>
        <span style={{ color: 'var(--muted)', fontSize: '.8rem' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className="history-jornada-body">
          {favoriteTeam && (
            <p style={{ fontSize: '.72rem', color: '#f59e0b', fontFamily: 'var(--mono)', marginBottom: '.4rem' }}>
              ⭐ Favorito: {favoriteTeam}
            </p>
          )}
          <div className="history-col-headers">
            <span />
            <span>Pred</span>
            <span>Real</span>
            <span />
          </div>
          {matches
            .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate))
            .map(m => {
              const pred = predMap[m.matchId];
              const isFavorite = !!favoriteTeam &&
                (m.homeTeam === favoriteTeam || m.awayTeam === favoriteTeam);
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
                  <span className="pred">
                    {pred ? `${pred.homeScore}:${pred.awayScore}` : '–'}
                  </span>
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

export default function HistoryTab() {
  const { user } = useAuth();
  const { matchdayData, loading: matchLoading } = useMatches();
  const [allPreds, setAllPreds]           = useState({});
  const [monthlyResults, setMonthlyResults] = useState({});
  const [monthlyPreds, setMonthlyPreds]   = useState({});
  const [loading, setLoading]             = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getAllPredictions(user.uid),
      getAllMonthlyResults(),
      getAllMonthlyPredictionsForUser(user.uid),
    ]).then(([preds, mResults, mPreds]) => {
      setAllPreds(preds);
      setMonthlyResults(mResults || {});
      setMonthlyPreds(mPreds || {});
    }).finally(() => setLoading(false));
  }, [user]);

  if (loading || matchLoading) return <LoadingSpinner text="Cargando historial…" />;

  // Compute global stats client-side from all jornadas
  let cTotalPts = 0, cExactCount = 0, cSignCount = 0, cMatchesWithResult = 0;
  Object.entries(allPreds).forEach(([md, predData]) => {
    const mdMatches = matchdayData[Number(md)] || [];
    const favoriteTeam = predData?.favoriteTeam || null;
    const predMap = {};
    (predData?.matches || []).forEach(p => { predMap[p.matchId] = p; });
    mdMatches.forEach(m => {
      const pred = predMap[m.matchId];
      if (!pred || m.homeScore === null || m.awayScore === null) return;
      cMatchesWithResult++;
      const isFav = !!favoriteTeam && (m.homeTeam === favoriteTeam || m.awayTeam === favoriteTeam);
      const badge = resultBadge(pred, m, isFav);
      if (badge) {
        cTotalPts += badge.pts;
        if (badge.cls.includes('exact')) cExactCount++;
        else if (badge.cls.includes('sign')) cSignCount++;
      }
    });
  });

  // Add monthly pts computed client-side
  let cMonthlyPts = 0;
  Object.entries(monthlyPreds).forEach(([key, pred]) => {
    const result = monthlyResults[key];
    if (!result) return;
    MONTHLY_CATEGORIES.forEach(cat => {
      const val = result[cat.key];
      const resultTeam = val?.team ?? val ?? null;
      const userTeam = pred?.[cat.key] ?? null;
      if (resultTeam && userTeam && userTeam === resultTeam) cMonthlyPts += 10;
    });
  });

  const totalPoints = cTotalPts + cMonthlyPts;
  const exactCount  = cExactCount;
  const signCount   = cSignCount;
  const accuracy    = cMatchesWithResult > 0
    ? Math.round((cExactCount + cSignCount) / cMatchesWithResult * 100)
    : 0;

  const jornadasWithPreds = Object.keys(allPreds).map(Number).sort((a, b) => b - a);

  return (
    <>
      <div className="history-stats">
        <div className="hstat"><div className="val">{totalPoints}</div><div className="lbl">Puntos</div></div>
        <div className="hstat"><div className="val">{exactCount}</div><div className="lbl">Exactos</div></div>
        <div className="hstat"><div className="val">{signCount}</div><div className="lbl">Signos</div></div>
        <div className="hstat"><div className="val">{accuracy}%</div><div className="lbl">Aciertos</div></div>
      </div>

      {SEASON_MONTHS.filter(mo => {
        const r = monthlyResults[mo.key];
        return r && (r.bestPlayer || r.bestCoach || r.bestU23);
      }).reverse().map(mo => (
        <HistoryMonthCard
          key={mo.key}
          month={mo}
          result={monthlyResults[mo.key]}
          pred={monthlyPreds[mo.key]}
        />
      ))}

      {jornadasWithPreds.length === 0 ? (
        <div className="empty-state">
          <img src={`${import.meta.env.BASE_URL}icon-empty.png`} alt="" className="empty-icon" />
          <p>Aún no tienes predicciones guardadas.</p>
        </div>
      ) : (
        jornadasWithPreds.map(md => (
          <HistoryJornada
            key={md}
            matchday={md}
            predData={allPreds[md]}
            matchdayData={matchdayData[md]}
          />
        ))
      )}
    </>
  );
}
