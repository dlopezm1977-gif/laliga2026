import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { crestUrl } from '../../lib/crests';
import { getAllPredictions, getUserScore, getAllMonthlyResults, getAllMonthlyPredictionsForUser } from '../../lib/firestore';
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

function HistoryMonthCard({ month, result, pred, scoreData }) {
  const [open, setOpen] = useState(false);
  const monthPts = scoreData?.byMonth?.[month.key]?.points ?? null;

  const hasAnyResult = result && (result.bestPlayer || result.bestCoach || result.bestU23);
  if (!hasAnyResult) return null;

  return (
    <div className="history-jornada">
      <div className="history-jornada-hdr" onClick={() => setOpen(o => !o)}>
        <span style={{ fontWeight: 600 }}>{month.label}</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: '.72rem', color: 'var(--muted)' }}>mensual</span>
        <span className="j-pts">{monthPts ?? '–'} pts</span>
        <span style={{ color: 'var(--muted)', fontSize: '.8rem' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className="history-jornada-body">
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
                    ? <><img className="team-crest team-crest--sm" src={crestUrl(userTeam)} alt={userTeam} /><span style={{ fontSize: '.8rem' }}>{userTeam}</span></>
                    : <span style={{ color: 'var(--muted)', fontSize: '.75rem' }}>Sin pred.</span>
                  }
                </span>
                {resultTeam && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '.25rem' }}>
                    <img className="team-crest team-crest--sm" src={crestUrl(resultTeam)} alt={resultTeam} />
                    <span style={{ fontSize: '.78rem', color: 'var(--muted)' }}>{resultName ? `${resultName} (${resultTeam})` : resultTeam}</span>
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

function HistoryJornada({ matchday, predData, matchdayData, scoreData }) {
  const [open, setOpen] = useState(false);
  const matches      = matchdayData || [];
  const preds        = predData?.matches || [];
  const favoriteTeam = predData?.favoriteTeam || null;
  const jScore       = scoreData?.byMatchday?.[matchday];

  const predMap = {};
  preds.forEach(p => { predMap[p.matchId] = p; });

  return (
    <div className="history-jornada">
      <div className="history-jornada-hdr" onClick={() => setOpen(o => !o)}>
        <span style={{ fontWeight: 600 }}>Jornada {matchday}</span>
        <span style={{ display: 'flex', gap: '.6rem', alignItems: 'center', fontFamily: 'var(--mono)', fontSize: '.72rem', color: 'var(--muted)' }}>
          {jScore ? (
            <>
              <span>{jScore.exact ?? 0}✓</span>
              <span>{jScore.sign ?? 0}≈</span>
            </>
          ) : null}
        </span>
        <span className="j-pts">{jScore?.points ?? '–'} pts</span>
        <span style={{ color: 'var(--muted)', fontSize: '.8rem' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className="history-jornada-body">
          {favoriteTeam && (
            <p style={{ fontSize: '.72rem', color: '#f59e0b', fontFamily: 'var(--mono)', marginBottom: '.4rem' }}>
              ⭐ Favorito: {favoriteTeam}
            </p>
          )}
          {matches
            .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate))
            .map(m => {
              const pred = predMap[m.matchId];
              const isFavorite = !!favoriteTeam &&
                (m.homeTeam === favoriteTeam || m.awayTeam === favoriteTeam);
              const badge = pred ? resultBadge(pred, m, isFavorite) : null;
              return (
                <div className="history-match-row" key={m.matchId}>
                  <span className="teams">
                    <img className="team-crest team-crest--sm" src={crestUrl(m.homeTeam)} alt={m.homeTeam} />
                    {m.homeTeam} – {m.awayTeam}
                    <img className="team-crest team-crest--sm" src={crestUrl(m.awayTeam)} alt={m.awayTeam} />
                  </span>
                  <span className="pred">
                    {pred ? `${pred.homeScore}:${pred.awayScore}` : '–'}
                  </span>
                  <span className="real">
                    {m.homeScore !== null ? `${m.homeScore}:${m.awayScore}` : '?'}
                  </span>
                  {badge ? (
                    <span className={`result-badge ${badge.cls}`}>{badge.label}</span>
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
  const [score, setScore]                 = useState(null);
  const [monthlyResults, setMonthlyResults] = useState({});
  const [monthlyPreds, setMonthlyPreds]   = useState({});
  const [loading, setLoading]             = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getAllPredictions(user.uid),
      getUserScore(user.uid),
      getAllMonthlyResults(),
      getAllMonthlyPredictionsForUser(user.uid),
    ]).then(([preds, sc, mResults, mPreds]) => {
      setAllPreds(preds);
      setScore(sc);
      setMonthlyResults(mResults || {});
      setMonthlyPreds(mPreds || {});
    }).finally(() => setLoading(false));
  }, [user]);

  if (loading || matchLoading) return <LoadingSpinner text="Cargando historial…" />;

  const totalPoints  = score?.totalPoints ?? 0;
  const exactCount   = score?.exactCount  ?? 0;
  const signCount    = score?.signCount   ?? 0;
  const totalMatches = (exactCount + signCount + (score?.matchdaysPlayed ?? 0));
  const accuracy      = totalMatches > 0
    ? Math.round((exactCount + signCount) / totalMatches * 100)
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
          scoreData={score}
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
            scoreData={score}
          />
        ))
      )}
    </>
  );
}
