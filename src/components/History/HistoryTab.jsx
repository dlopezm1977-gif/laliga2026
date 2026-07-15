import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { crestUrl } from '../../lib/crests';
import { getAllPredictions, getUserScore } from '../../lib/firestore';
import { useMatches } from '../../hooks/useMatches';
import LoadingSpinner from '../LoadingSpinner';

function getSign(h, a) {
  if (h > a) return 'H';
  if (a > h) return 'A';
  return 'D';
}

function resultBadge(pred, real) {
  if (real.homeScore === null || real.awayScore === null) return null;
  if (pred.homeScore === real.homeScore && pred.awayScore === real.awayScore) {
    return { label: 'Exacto', cls: 'exact', pts: 3 };
  }
  if (getSign(pred.homeScore, pred.awayScore) === getSign(real.homeScore, real.awayScore)) {
    return { label: 'Signo', cls: 'sign', pts: 1 };
  }
  return { label: 'Fallo', cls: 'miss', pts: 0 };
}

function HistoryJornada({ matchday, predData, matchdayData, scoreData }) {
  const [open, setOpen] = useState(false);
  const matches = matchdayData || [];
  const preds   = predData?.matches || [];
  const jScore  = scoreData?.byMatchday?.[matchday];

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
          {matches
            .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate))
            .map(m => {
              const pred = predMap[m.matchId];
              const badge = pred
                ? resultBadge(pred, m)
                : null;
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
  const [allPreds, setAllPreds] = useState({});
  const [score, setScore]       = useState(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getAllPredictions(user.uid),
      getUserScore(user.uid),
    ]).then(([preds, sc]) => {
      setAllPreds(preds);
      setScore(sc);
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
