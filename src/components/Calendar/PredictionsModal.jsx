import { useState, useEffect } from 'react';
import { getAllMatchdayPredictions } from '../../lib/firestore';
import { crestUrl, teamAbbr } from '../../lib/crests';
import LoadingSpinner from '../LoadingSpinner';

function getSign(h, a) {
  if (h > a) return 'H';
  if (a > h) return 'A';
  return 'D';
}

function resultTier(pred, real, isFav) {
  if (real == null) return null;
  if (pred.homeScore === real.homeScore && pred.awayScore === real.awayScore) {
    return isFav ? 0 : 1; // exact fav / exact
  }
  if (getSign(pred.homeScore, pred.awayScore) === getSign(real.homeScore, real.awayScore)) {
    return isFav ? 2 : 3; // sign fav / sign
  }
  return 4; // miss
}

function predCategory(h, a) {
  if (h > a) return 0;
  if (h === a) return 1;
  return 2;
}

function sortRows(rows, real) {
  if (real == null) {
    return [...rows].sort((a, b) => {
      const catDiff = predCategory(a.homeScore, a.awayScore) - predCategory(b.homeScore, b.awayScore);
      if (catDiff !== 0) return catDiff;
      return (a.homeScore + a.awayScore) - (b.homeScore + b.awayScore);
    });
  }
  return [...rows].sort((a, b) => {
    const tierA = resultTier(a, real, a.isFav);
    const tierB = resultTier(b, real, b.isFav);
    return tierA - tierB;
  });
}

const TIER_LABELS = ['⭐ Exacto', 'Exacto', '⭐ Signo', 'Signo', 'Fallo'];
const TIER_CLS    = ['exact fav', 'exact', 'sign fav', 'sign', 'miss'];
const TIER_PTS    = [6, 3, 2, 1, 0];
const GROUP_LABELS = ['Local', 'Empate', 'Visitante'];

export default function PredictionsModal({ match, matchday, onClose }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows]       = useState([]);
  const [error, setError]     = useState(null);

  const hasLiveScore = match.homeScore != null &&
    ['FINISHED', 'IN_PLAY', 'PAUSED', 'LIVE'].includes(match.status);
  const real = hasLiveScore
    ? { homeScore: match.homeScore, awayScore: match.awayScore }
    : null;

  useEffect(() => {
    getAllMatchdayPredictions(matchday)
      .then(allPreds => {
        const result = [];
        allPreds.forEach(({ username, matches, favoriteTeam }) => {
          const pred = matches.find(p => p.matchId === match.matchId);
          if (pred == null || pred.homeScore == null) return;
          const isFav = !!favoriteTeam &&
            (match.homeTeam === favoriteTeam || match.awayTeam === favoriteTeam);
          result.push({ username, homeScore: pred.homeScore, awayScore: pred.awayScore, isFav });
        });
        setRows(sortRows(result, real));
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [match.matchId, matchday]);

  // group by result (live/finished) or by sign prediction (pending)
  const grouped = [];
  if (real) {
    const buckets = [
      { label: 'Resultado exacto', groupCls: 'exact', rows: [] },
      { label: 'Signo acertado',   groupCls: 'sign',  rows: [] },
      { label: 'Fallo',            groupCls: 'miss',  rows: [] },
    ];
    rows.forEach(r => {
      const tier = resultTier(r, real, r.isFav);
      const bucketIdx = tier <= 1 ? 0 : tier <= 3 ? 1 : 2;
      buckets[bucketIdx].rows.push({ ...r, pts: TIER_PTS[tier], cls: TIER_CLS[tier] });
    });
    // Sort fallo rows by predicted score (sign category, then total goals)
    buckets[2].rows.sort((a, b) => {
      const catDiff = predCategory(a.homeScore, a.awayScore) - predCategory(b.homeScore, b.awayScore);
      return catDiff !== 0 ? catDiff : (a.homeScore + a.awayScore) - (b.homeScore + b.awayScore);
    });
    buckets.forEach(g => { if (g.rows.length) grouped.push(g); });
  } else {
    const cats = [[], [], []];
    rows.forEach(r => cats[predCategory(r.homeScore, r.awayScore)].push(r));
    cats.forEach((g, i) => {
      if (g.length) grouped.push({ label: GROUP_LABELS[i], groupCls: null, rows: g });
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="pred-modal-match">
            <div className="pred-modal-side">
              <img className="team-crest team-crest--sm" src={crestUrl(match.homeTeam)} alt={match.homeTeam} />
              <span className="pred-modal-team pred-modal-team--full">{match.homeTeam}</span>
              <span className="pred-modal-team pred-modal-team--abbr">{teamAbbr(match.homeTeam)}</span>
            </div>
            {real
              ? <span className="pred-modal-real">{real.homeScore}–{real.awayScore}</span>
              : <span className="pred-modal-vs">–</span>
            }
            <div className="pred-modal-side pred-modal-side--away">
              <span className="pred-modal-team pred-modal-team--full">{match.awayTeam}</span>
              <span className="pred-modal-team pred-modal-team--abbr">{teamAbbr(match.awayTeam)}</span>
              <img className="team-crest team-crest--sm" src={crestUrl(match.awayTeam)} alt={match.awayTeam} />
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <LoadingSpinner text="Cargando predicciones…" />
        ) : error ? (
          <p className="pred-modal-empty" style={{ color: 'var(--accent)' }}>Error: {error}</p>
        ) : rows.length === 0 ? (
          <p className="pred-modal-empty">Nadie ha predicho este partido aún.</p>
        ) : (
          grouped.map((g, i) => (
            <div key={i}>
              <div className={`pred-group-label${g.groupCls ? ` pred-group-label--${g.groupCls}` : ''}`}>
                {g.label}
              </div>
              {g.rows.map((r, j) => (
                <div className="pred-modal-row" key={j}>
                  <span className="pred-modal-user">{r.isFav && <span title="Favorito">⭐</span>}{r.username}</span>
                  <div className="pred-modal-row-right">
                    <span className={`pred-modal-score${r.cls ? ` result-badge ${r.cls}` : ''}`}>
                      {r.homeScore}–{r.awayScore}
                    </span>
                    {r.pts != null && <span className="pred-modal-row-pts">+{r.pts}</span>}
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
