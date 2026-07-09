import { useState, useEffect } from 'react';
import { useMatches } from '../../hooks/useMatches';
import { crestUrl } from '../../lib/crests';
import { useAuth } from '../../contexts/AuthContext';
import { getPrediction, savePrediction } from '../../lib/firestore';

function ScoreSpinner({ value, onChange, disabled }) {
  const n = value ?? 0;
  return (
    <div className="predict-score">
      <div className="score-spinner">
        <button type="button" onClick={() => onChange(Math.min(9, n + 1))} disabled={disabled}>▲</button>
        <button type="button" onClick={() => onChange(Math.max(0, n - 1))} disabled={disabled}>▼</button>
      </div>
      <div className="score-val">
        <input
          type="number" min={0} max={9}
          value={n}
          onChange={e => onChange(Math.max(0, Math.min(9, +e.target.value || 0)))}
          readOnly={disabled}
        />
      </div>
    </div>
  );
}

function PredictCard({ match, pred, onUpdate, closed }) {
  const home = pred?.homeScore ?? 0;
  const away = pred?.awayScore ?? 0;

  return (
    <div className={`predict-card${closed ? ' closed' : ''}`}>
      <div className="match-team home">
        {match.homeTeam}
        <img className="team-crest" src={crestUrl(match.homeTeam)} alt={match.homeTeam} />
      </div>
      <div className="predict-center">
        <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
          <ScoreSpinner value={home} onChange={v => onUpdate(match.matchId, 'homeScore', v)} disabled={closed} />
          <span className="predict-sep">:</span>
          <ScoreSpinner value={away} onChange={v => onUpdate(match.matchId, 'awayScore', v)} disabled={closed} />
        </div>
      </div>
      <div className="match-team away">
        <img className="team-crest" src={crestUrl(match.awayTeam)} alt={match.awayTeam} />
        {match.awayTeam}
      </div>
    </div>
  );
}

function deadlineLabel(matches) {
  if (!matches.length) return null;
  const dates = matches.map(m => new Date(m.utcDate)).filter(Boolean);
  dates.sort((a, b) => a - b);
  const first = dates[0];
  return first.toLocaleString('es-ES', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Madrid',
  });
}

export default function PredictTab() {
  const { user } = useAuth();
  const { currentMatchday, getMatches, loading: matchesLoading } = useMatches();
  const [jornada, setJornada]   = useState(null);
  const [preds, setPreds]       = useState({});
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [loadingPreds, setLoadingPreds] = useState(false);

  const activeJornada = jornada ?? currentMatchday;
  const matches = getMatches(activeJornada);

  const firstMatchTime = matches.length
    ? Math.min(...matches.map(m => new Date(m.utcDate).getTime()).filter(Boolean))
    : Infinity;
  const isClosed = Date.now() >= firstMatchTime;

  // Load saved predictions whenever jornada changes
  useEffect(() => {
    if (!user || !activeJornada) return;
    setLoadingPreds(true);
    getPrediction(user.uid, activeJornada)
      .then(data => {
        if (data?.matches) {
          const map = {};
          data.matches.forEach(m => { map[m.matchId] = m; });
          setPreds(map);
        } else {
          setPreds({});
        }
      })
      .finally(() => setLoadingPreds(false));
  }, [user, activeJornada]);

  function handleUpdate(matchId, field, value) {
    setPreds(prev => ({
      ...prev,
      [matchId]: { ...(prev[matchId] || { matchId }), [field]: value },
    }));
    setSaved(false);
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    setSaved(false);
    try {
      const matchList = matches.map(m => ({
        matchId:   m.matchId,
        homeScore: preds[m.matchId]?.homeScore ?? 0,
        awayScore: preds[m.matchId]?.awayScore ?? 0,
      }));
      await savePrediction(user.uid, activeJornada, matchList);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  if (matchesLoading || loadingPreds) return <div className="loading">Cargando…</div>;

  const deadline = deadlineLabel(matches);

  return (
    <>
      <div className="jornada-nav">
        <button
          className="btn-nav"
          onClick={() => { setJornada(Math.max(1, activeJornada - 1)); setSaved(false); }}
          disabled={activeJornada <= 1}
        >‹</button>
        <div>
          <h2>Jornada {activeJornada}</h2>
          {deadline && (
            <span className="dates">
              {isClosed
                ? <span className="deadline-badge">Cerrada</span>
                : <>Cierre: {deadline}</>
              }
            </span>
          )}
        </div>
        <button
          className="btn-nav"
          onClick={() => { setJornada(Math.min(38, activeJornada + 1)); setSaved(false); }}
          disabled={activeJornada >= 38}
        >›</button>
      </div>

      {matches.length === 0 ? (
        <div className="loading">No hay datos para esta jornada</div>
      ) : (
        <>
          {matches
            .slice()
            .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate))
            .map(m => (
              <PredictCard
                key={m.matchId}
                match={m}
                pred={preds[m.matchId]}
                onUpdate={handleUpdate}
                closed={isClosed}
              />
            ))
          }

          {!isClosed && (
            <button className="btn-save" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar predicciones'}
            </button>
          )}
          {saved && <div className="save-ok">✓ Predicciones guardadas</div>}
        </>
      )}
    </>
  );
}
