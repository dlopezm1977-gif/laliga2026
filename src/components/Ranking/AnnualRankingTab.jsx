import { useState, useEffect } from 'react';
import { getAllSeasonPredictions, getSeasonResults } from '../../lib/firestore';
import { crestUrl } from '../../lib/crests';
import LoadingSpinner from '../LoadingSpinner';

const SECTIONS = [
  { key: 'ganadorLiga',   label: '🏆 Campeón de Liga',   pts: '25 pts',     ptsEach: 25, type: 'single' },
  { key: 'champions',     label: '⭐ Champions League',   pts: '10 pts c/u', ptsEach: 10, type: 'multi'  },
  { key: 'uel',           label: '🟠 Europa League',      pts: '7 pts',      ptsEach:  7, type: 'single' },
  { key: 'uecl',          label: '🟢 Conference League',  pts: '5 pts',      ptsEach:  5, type: 'single' },
  { key: 'descenso',      label: '⬇️ Descenso',           pts: '10 pts c/u', ptsEach: 10, type: 'multi'  },
  { key: 'mejorPorteria', label: '🧤 Mejor portería',     pts: '15 pts',     ptsEach: 15, type: 'single' },
  { key: 'empatador',     label: '⚖️ Más empates',        pts: '10 pts',     ptsEach: 10, type: 'single' },
];

function groupByTeam(preds, sec) {
  const map = {};
  preds.forEach(p => {
    const val = p[sec.key];
    if (!val) return;
    const teams = sec.type === 'multi' ? (Array.isArray(val) ? val : []) : [val];
    teams.forEach(t => {
      if (!map[t]) map[t] = [];
      map[t].push(p.username);
    });
  });
  return Object.entries(map).sort(([, a], [, b]) => b.length - a.length);
}

function PredModal({ sec, preds, onClose }) {
  const groups = groupByTeam(preds, sec);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{sec.label}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <p style={{ fontSize: '.68rem', color: 'var(--muted)', fontFamily: 'var(--mono)', marginBottom: '.5rem' }}>
          {sec.pts}{sec.type === 'multi' ? ' · cada equipo acertado' : ''}
        </p>
        {groups.length === 0 ? (
          <p className="pred-modal-empty">Nadie ha predicho aún.</p>
        ) : groups.map(([team, users]) => (
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
        ))}
      </div>
    </div>
  );
}

function ResultModal({ sec, result, preds, onClose }) {
  const resultVal   = result[sec.key];
  const resultTeams = sec.type === 'multi'
    ? (Array.isArray(resultVal) ? resultVal : [])
    : (resultVal ? [resultVal] : []);

  const rows = preds.map(p => {
    const userVal   = p[sec.key];
    const userTeams = sec.type === 'multi' ? (Array.isArray(userVal) ? userVal : []) : (userVal ? [userVal] : []);
    const correct   = userTeams.filter(t => resultTeams.includes(t));
    const pts       = correct.length * sec.ptsEach;
    return { username: p.username, userTeams, correct, pts };
  });

  const acertados   = rows.filter(r => r.pts > 0).sort((a, b) => b.pts - a.pts || a.username.localeCompare(b.username));
  const fallados    = rows.filter(r => r.userTeams.length > 0 && r.pts === 0).sort((a, b) => a.username.localeCompare(b.username));
  const sinPred     = rows.filter(r => r.userTeams.length === 0).sort((a, b) => a.username.localeCompare(b.username));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{sec.label}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.35rem', padding: '.3rem 0 .6rem' }}>
          {resultTeams.map(t => (
            <span key={t} style={{ display: 'flex', alignItems: 'center', gap: '.3rem' }}>
              <img className="team-crest team-crest--sm" src={crestUrl(t)} alt={t} />
              <span style={{ fontWeight: 700, fontSize: '.85rem' }}>{t}</span>
            </span>
          ))}
        </div>

        {acertados.length > 0 && (
          <>
            <div className="pred-group-label">✓ Acertados <span className="pred-group-pts">{acertados.length}</span></div>
            {acertados.map(({ username, correct, pts }) => (
              <div className="pred-modal-row" key={username}>
                <span className="pred-modal-user">{username}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '.3rem' }}>
                  {sec.type === 'multi' && correct.map(t => (
                    <img key={t} className="team-crest team-crest--sm" src={crestUrl(t)} alt={t} />
                  ))}
                  <span className="pred-modal-score result-badge exact">+{pts} pts</span>
                </span>
              </div>
            ))}
          </>
        )}

        {fallados.length > 0 && (
          <>
            <div className="pred-group-label">✗ Fallados <span className="pred-group-pts">{fallados.length}</span></div>
            {fallados.map(({ username, userTeams }) => (
              <div className="pred-modal-row" key={username}>
                <span className="pred-modal-user">{username}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '.3rem' }}>
                  {userTeams.slice(0, 2).map(t => (
                    <img key={t} className="team-crest team-crest--sm" src={crestUrl(t)} alt={t} />
                  ))}
                  <span className="pred-modal-score result-badge miss">0 pts</span>
                </span>
              </div>
            ))}
          </>
        )}

        {sinPred.length > 0 && (
          <>
            <div className="pred-group-label">Sin predicción</div>
            {sinPred.map(({ username }) => (
              <div className="pred-modal-row" key={username}>
                <span className="pred-modal-user" style={{ color: 'var(--muted)' }}>{username}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function AnnualSection({ preds, result }) {
  const [selected, setSelected] = useState(null);
  const selectedSec = SECTIONS.find(s => s.key === selected) ?? null;
  const hasResults  = result !== null;

  return (
    <div className="season-card" style={{ marginBottom: '1.25rem' }}>
      <div className="monthly-rank-header" style={{ marginBottom: '.5rem' }}>
        Temporada{hasResults ? '' : ' — predicciones'}
      </div>
      {SECTIONS.map(sec => {
        const resultVal  = result?.[sec.key];
        const hasResult  = sec.type === 'multi'
          ? Array.isArray(resultVal) && resultVal.length > 0
          : !!resultVal;
        const voteCount  = preds.filter(p => {
          const v = p[sec.key];
          return sec.type === 'multi' ? v?.length > 0 : !!v;
        }).length;

        return (
          <div
            key={sec.key}
            className="monthly-rank-row"
            style={{ cursor: 'pointer' }}
            onClick={() => setSelected(sec.key)}
          >
            <span className="monthly-rank-cat">{sec.label}</span>
            {hasResult ? (
              <span className="monthly-rank-winner">
                {sec.type === 'single' ? (
                  <>
                    <img className="team-crest team-crest--sm" src={crestUrl(resultVal)} alt={resultVal} />
                    <span>{resultVal}</span>
                  </>
                ) : (
                  resultVal.map(t => (
                    <img key={t} className="team-crest team-crest--sm" src={crestUrl(t)} alt={t} />
                  ))
                )}
              </span>
            ) : (
              <span className="pred-group-pts">
                {voteCount === 0 ? 'Sin elegir' : `${voteCount} votos`}
              </span>
            )}
          </div>
        );
      })}

      {selected && !hasResults && (
        <PredModal sec={selectedSec} preds={preds} onClose={() => setSelected(null)} />
      )}
      {selected && hasResults && (
        <ResultModal sec={selectedSec} result={result} preds={preds} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

export default function AnnualRankingTab() {
  const [preds,   setPreds]   = useState([]);
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getAllSeasonPredictions(), getSeasonResults()])
      .then(([p, r]) => { setPreds(p); setResult(r); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner text="Cargando predicciones…" />;

  return (
    <>
      <p style={{ fontSize: '.72rem', color: 'var(--muted)', fontFamily: 'var(--mono)', marginBottom: '1rem' }}>
        25 pts campeón · 10 pts c/u Champions/descenso · 15 pts portería · 10 pts empates · 7/5 pts Europa
      </p>
      <AnnualSection preds={preds} result={result} />
    </>
  );
}
