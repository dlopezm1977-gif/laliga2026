import { useState, useEffect } from 'react';
import { getAllMonthlyResults, getAllMonthPredictions } from '../../lib/firestore';
import { crestUrl, teamAbbr } from '../../lib/crests';
import { SEASON_MONTHS, MONTHLY_CATEGORIES, isMonthClosed } from '../../lib/months';
import LoadingSpinner from '../LoadingSpinner';

function groupPredsByTeam(preds, catKey) {
  const map = {};
  preds.forEach(({ username, [catKey]: team }) => {
    if (!team) return;
    if (!map[team]) map[team] = [];
    map[team].push(username);
  });
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
}

function CategoryModal({ cat, groups, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{cat.emoji} {cat.label}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {groups.length === 0 ? (
          <p className="pred-modal-empty">Nadie ha predicho aún.</p>
        ) : (
          groups.map(([team, users]) => (
            <div key={team}>
              <div className="pred-group-label">
                <img className="team-crest team-crest--sm" src={crestUrl(team)} alt={team} style={{ marginRight: '.3rem' }} />
                {team}
                <span className="pred-group-pts">{users.length}</span>
              </div>
              {users.map(u => (
                <div className="pred-modal-row" key={u}>
                  <span className="pred-modal-user">{u}</span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function NextMonthSection({ month, preds, loading }) {
  const [selected, setSelected] = useState(null);
  const selectedCat = selected ? MONTHLY_CATEGORIES.find(c => c.key === selected) : null;
  const selectedGroups = selected ? groupPredsByTeam(preds, selected) : [];

  return (
    <div className="season-card" style={{ marginBottom: '1.25rem' }}>
      <div className="monthly-rank-header" style={{ marginBottom: '.5rem' }}>
        {month.label} — predicciones
      </div>
      {loading ? <LoadingSpinner /> : (
        MONTHLY_CATEGORIES.map(cat => {
          const total = preds.filter(p => p[cat.key]).length;
          return (
            <div
              key={cat.key}
              className="monthly-rank-row"
              style={{ cursor: 'pointer' }}
              onClick={() => setSelected(cat.key)}
            >
              <span className="monthly-rank-cat">{cat.emoji} {cat.label}</span>
              <span className="pred-group-pts">
                {total === 0 ? 'Sin elegir' : `${total} votos`}
              </span>
            </div>
          );
        })
      )}

      {selected && (
        <CategoryModal
          cat={selectedCat}
          groups={selectedGroups}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function HistoryResultModal({ cat, result, monthKey, onClose }) {
  const [preds, setPreds]   = useState([]);
  const [loading, setLoading] = useState(true);

  const val        = result?.[cat.key];
  const resultTeam = val?.team ?? val ?? null;
  const resultName = val?.name ?? null;

  useEffect(() => {
    getAllMonthPredictions(monthKey)
      .then(setPreds)
      .finally(() => setLoading(false));
  }, [monthKey]);

  const correct = preds
    .filter(p => p[cat.key] && p[cat.key] === resultTeam)
    .map(p => ({ username: p.username, team: p[cat.key] }))
    .sort((a, b) => a.username.localeCompare(b.username));

  const wrong = preds
    .filter(p => p[cat.key] && p[cat.key] !== resultTeam)
    .map(p => ({ username: p.username, team: p[cat.key] }))
    .sort((a, b) => a.username.localeCompare(b.username));

  const noVote = preds
    .filter(p => !p[cat.key])
    .map(p => ({ username: p.username, team: null }))
    .sort((a, b) => a.username.localeCompare(b.username));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{cat.emoji} {cat.label}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {resultTeam && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.3rem 0 .6rem' }}>
            <img className="team-crest team-crest--sm" src={crestUrl(resultTeam)} alt={resultTeam} />
            <span style={{ fontWeight: 700, fontSize: '.9rem' }}>
              {resultName ? `${resultName}` : resultTeam}
            </span>
            {resultName && <span style={{ color: 'var(--muted)', fontSize: '.78rem' }}>({resultTeam})</span>}
          </div>
        )}

        {loading ? <LoadingSpinner /> : (
          <>
            {correct.length > 0 && (
              <>
                <div className="pred-group-label">
                  ✓ Acertados
                  <span className="pred-group-pts">{correct.length}</span>
                </div>
                {correct.map(({ username, team }) => (
                  <div className="pred-modal-row" key={username}>
                    <span className="pred-modal-user">{username}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '.3rem' }}>
                      {team && <img className="team-crest team-crest--sm" src={crestUrl(team)} alt={team} />}
                      {team && <span className="pred-modal-team--full" style={{ fontSize: '.78rem', color: 'var(--muted)' }}>{team}</span>}
                      {team && <span className="pred-modal-team--abbr" style={{ fontSize: '.78rem', color: 'var(--muted)' }}>{teamAbbr(team)}</span>}
                      <span className="pred-modal-score result-badge exact">+10 pts</span>
                    </span>
                  </div>
                ))}
              </>
            )}

            {wrong.length > 0 && (
              <>
                <div className="pred-group-label">
                  ✗ Fallados
                  <span className="pred-group-pts">{wrong.length}</span>
                </div>
                {wrong.map(({ username, team }) => (
                  <div className="pred-modal-row" key={username}>
                    <span className="pred-modal-user">{username}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '.3rem' }}>
                      {team && <img className="team-crest team-crest--sm" src={crestUrl(team)} alt={team} />}
                      {team && <span className="pred-modal-team--full" style={{ fontSize: '.78rem', color: 'var(--muted)' }}>{team}</span>}
                      {team && <span className="pred-modal-team--abbr" style={{ fontSize: '.78rem', color: 'var(--muted)' }}>{teamAbbr(team)}</span>}
                      <span className="pred-modal-score result-badge miss">0 pts</span>
                    </span>
                  </div>
                ))}
              </>
            )}

            {noVote.length > 0 && (
              <>
                <div className="pred-group-label">Sin predicción</div>
                {noVote.map(({ username }) => (
                  <div className="pred-modal-row" key={username}>
                    <span className="pred-modal-user" style={{ color: 'var(--muted)' }}>{username}</span>
                  </div>
                ))}
              </>
            )}

            {preds.length === 0 && (
              <p className="pred-modal-empty">Nadie predijo este mes.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function HistoryMonthSection({ month, result }) {
  const [selected, setSelected] = useState(null);
  const selectedCat = selected ? MONTHLY_CATEGORIES.find(c => c.key === selected) : null;

  return (
    <div className="season-card">
      <div className="monthly-rank-header">{month.label}</div>
      {MONTHLY_CATEGORIES.map(cat => {
        const val  = result?.[cat.key];
        const isObj = val && typeof val === 'object';
        const team = isObj ? (val.team ?? null) : (val ?? null);
        const name = isObj ? (val.name ?? null) : null;
        return (
          <div
            key={cat.key}
            className="monthly-rank-row"
            style={{ cursor: team ? 'pointer' : 'default' }}
            onClick={() => team && setSelected(cat.key)}
          >
            <span className="monthly-rank-cat">{cat.emoji} {cat.label}</span>
            {team ? (
              <span className="monthly-rank-winner">
                <img className="team-crest team-crest--sm" src={crestUrl(team)} alt={team} />
                <span>{name ? `${name} (${team})` : team}</span>
              </span>
            ) : (
              <span className="monthly-rank-pending">Pendiente</span>
            )}
          </div>
        );
      })}

      {selected && (
        <HistoryResultModal
          cat={selectedCat}
          result={result}
          monthKey={month.key}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

export default function MonthlyRankingTab() {
  const [results, setResults]         = useState({});
  const [nextPreds, setNextPreds]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [loadingNext, setLoadingNext] = useState(false);

  // Load results first
  useEffect(() => {
    setLoading(true);
    getAllMonthlyResults()
      .then(res => setResults(res || {}))
      .finally(() => setLoading(false));
  }, []);

  // Once results are loaded, determine next open month and load its predictions
  const hasVal = v => v && (typeof v === 'object' ? !!v.team : true);
  const hasResult = mo => {
    const r = results[mo.key];
    return !!(r && (hasVal(r.bestPlayer) || hasVal(r.bestCoach) || hasVal(r.bestU23)));
  };
  const nextMonth     = SEASON_MONTHS.find(mo => !isMonthClosed(mo) && !hasResult(mo)) ?? null;
  const historyMonths = SEASON_MONTHS.filter(mo => isMonthClosed(mo) || hasResult(mo)).reverse();

  useEffect(() => {
    if (loading || !nextMonth) return;
    setLoadingNext(true);
    setNextPreds([]);
    getAllMonthPredictions(nextMonth.key)
      .then(setNextPreds)
      .finally(() => setLoadingNext(false));
  }, [loading, nextMonth?.key]);

  if (loading) return <LoadingSpinner text="Cargando premios…" />;

  return (
    <>
      <p style={{ fontSize: '.72rem', color: 'var(--muted)', fontFamily: 'var(--mono)', marginBottom: '1rem' }}>
        10 pts por cada acierto · máx. 30 pts/mes
      </p>

      {nextMonth && (
        <NextMonthSection month={nextMonth} preds={nextPreds} loading={loadingNext} />
      )}

      {historyMonths.length === 0 ? (
        <div className="empty-state">
          <p>El historial mensual aparecerá aquí cuando termine el primer mes.</p>
        </div>
      ) : (
        historyMonths.map(mo => (
          <HistoryMonthSection key={mo.key} month={mo} result={results[mo.key]} />
        ))
      )}
    </>
  );
}
