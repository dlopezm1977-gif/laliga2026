import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useMatches } from '../../hooks/useMatches';
import { crestUrl } from '../../lib/crests';
import { getMonthlyPrediction, saveMonthlyPrediction } from '../../lib/firestore';
import { SEASON_MONTHS, MONTHLY_CATEGORIES } from '../../lib/months';
import LoadingSpinner from '../LoadingSpinner';

function getMonthDeadline(matchdayData, { year, month }) {
  // August: first match of the month
  if (month === 8) {
    let earliest = Infinity;
    for (const matches of Object.values(matchdayData)) {
      for (const m of matches) {
        if (!m.utcDate) continue;
        const d = new Date(m.utcDate);
        const [y, mo] = d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' })
          .split('-').map(Number);
        if (y === year && mo === month) earliest = Math.min(earliest, d.getTime());
      }
    }
    return earliest === Infinity ? null : earliest;
  }
  // Rest: 1st of the month at 00:00 Madrid time
  // Search UTC offsets around midnight to handle CEST (UTC+2) and CET (UTC+1)
  const target = `${year}-${String(month).padStart(2, '0')}-01`;
  for (let h = -4; h <= 4; h++) {
    const ts = new Date(`${target}T00:00:00Z`).getTime() + h * 3600000;
    const candidate = new Date(ts);
    if (candidate.toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }) === `${target} 00:00:00`) return ts;
  }
  return new Date(`${target}T00:00:00Z`).getTime();
}

function formatDeadline(ts) {
  return new Date(ts).toLocaleString('es-ES', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Madrid',
  });
}

function defaultMonthIdx(matchdayData) {
  for (let i = 0; i < SEASON_MONTHS.length; i++) {
    const deadline = getMonthDeadline(matchdayData, SEASON_MONTHS[i]);
    const closed = deadline != null ? Date.now() >= deadline : false;
    if (!closed) return i;
  }
  return SEASON_MONTHS.length - 1;
}

function TeamPicker({ teams, selected, onSelect }) {
  return (
    <div className="season-picker">
      <div className="team-grid">
        {teams.map(t => (
          <button
            key={t}
            className={`team-option${selected === t ? ' selected' : ''}`}
            onClick={() => onSelect(t)}
            title={t}
          >
            <img src={crestUrl(t)} alt={t} />
            <span>{t}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SingleValue({ team }) {
  if (!team) return <span className="srow-empty">Sin elegir</span>;
  return (
    <span className="srow-single">
      <img className="team-crest" src={crestUrl(team)} alt={team} />
      <span className="team-full">{team}</span>
    </span>
  );
}

export default function MonthlyPredictTab() {
  const { user } = useAuth();
  const { matchdayData } = useMatches();
  const [activeIdx, setActiveIdx]     = useState(() => defaultMonthIdx({}));
  const [data, setData]               = useState({ bestPlayer: null, bestCoach: null, bestU23: null });
  const [editing, setEditing]         = useState(null);
  const [loading, setLoading]         = useState(false);
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [savedOnce, setSavedOnce]     = useState(false);
  const [hasChanges, setHasChanges]   = useState(false);

  const activeMonth = SEASON_MONTHS[activeIdx];

  const deadline = useMemo(
    () => getMonthDeadline(matchdayData, activeMonth),
    [matchdayData, activeMonth]
  );
  const isClosed = deadline != null ? Date.now() >= deadline : false;

  // default to first open month once matchdayData loads
  useEffect(() => {
    if (Object.keys(matchdayData).length > 0) {
      setActiveIdx(defaultMonthIdx(matchdayData));
    }
  }, [Object.keys(matchdayData).length]);

  const teams = useMemo(() => [...new Set(
    Object.values(matchdayData).flat().flatMap(m => [m.homeTeam, m.awayTeam])
  )].sort((a, b) => a.localeCompare(b)), [matchdayData]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setEditing(null);
    setHasChanges(false);
    setSaved(false);
    setSavedOnce(false);
    getMonthlyPrediction(user.uid, activeMonth.key)
      .then(d => {
        setData(d
          ? { bestPlayer: d.bestPlayer ?? null, bestCoach: d.bestCoach ?? null, bestU23: d.bestU23 ?? null }
          : { bestPlayer: null, bestCoach: null, bestU23: null }
        );
        if (d) setSavedOnce(true);
      })
      .finally(() => setLoading(false));
  }, [user, activeMonth.key]);

  function handleSelect(field, team) {
    setData(prev => ({ ...prev, [field]: prev[field] === team ? null : team }));
    setHasChanges(true);
    setSaved(false);
    setEditing(null);
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    try {
      await saveMonthlyPrediction(user.uid, activeMonth.key, data);
      setHasChanges(false);
      setSavedOnce(true);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="jornada-nav">
        <button
          className="btn-nav"
          onClick={() => { setActiveIdx(i => i - 1); }}
          disabled={activeIdx === 0}
        >‹</button>
        <div>
          <h2>{activeMonth.label}</h2>
          <span className="dates">
            {isClosed
              ? <span className="deadline-badge">Cerrada</span>
              : deadline
                ? <>Cierre: {formatDeadline(deadline)}</>
                : <span style={{ color: 'var(--muted)' }}>Sin partidos</span>
            }
          </span>
        </div>
        <button
          className="btn-nav"
          onClick={() => { setActiveIdx(i => i + 1); }}
          disabled={activeIdx === SEASON_MONTHS.length - 1}
        >›</button>
      </div>

      {loading ? <LoadingSpinner /> : (
        <>
          <p style={{ fontSize: '.72rem', color: 'var(--muted)', fontFamily: 'var(--mono)', marginBottom: '.75rem' }}>
            10 pts por acierto · máx. 30 pts/mes
          </p>
          {MONTHLY_CATEGORIES.map(cat => {
            const value = data[cat.key];
            const isEditing = editing === cat.key;
            return (
              <div key={cat.key} className="season-card">
                <div className="srow">
                  <div className="srow-left">
                    <span className="srow-label">{cat.emoji} {cat.label}</span>
                  </div>
                  <div className="srow-value">
                    <SingleValue team={value} />
                  </div>
                  {!isClosed && (
                    <button
                      className="srow-edit"
                      onClick={() => setEditing(isEditing ? null : cat.key)}
                    >
                      {isEditing ? 'Cerrar' : 'Elegir'}
                    </button>
                  )}
                </div>
                {isEditing && (
                  <TeamPicker
                    teams={teams}
                    selected={value}
                    onSelect={t => handleSelect(cat.key, t)}
                  />
                )}
              </div>
            );
          })}

          {!isClosed && (
            <button
              className="btn-save"
              onClick={handleSave}
              disabled={saving || !hasChanges}
            >
              {saving ? 'Guardando…' : (!hasChanges && savedOnce) ? '✓ Guardado' : 'Guardar predicciones'}
            </button>
          )}

          {saved && (
            <div className="save-overlay" onClick={() => setSaved(false)}>
              <img src={`${import.meta.env.BASE_URL}icon-success.png`} alt="" className="save-overlay-icon" />
              <p className="save-overlay-hint">Toca para continuar</p>
            </div>
          )}
        </>
      )}
    </>
  );
}
