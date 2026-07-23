import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useMatches } from '../../hooks/useMatches';
import { crestUrl } from '../../lib/crests';
import { getSeasonPrediction, saveSeasonPrediction } from '../../lib/firestore';
import LoadingSpinner from '../LoadingSpinner';

const ABBR = {
  'Real Madrid': 'RMA', 'Barcelona':    'BAR', 'Atlético':     'ATM',
  'Sevilla':     'SEV', 'Betis':        'BET', 'Real Sociedad':'RSO',
  'Villarreal':  'VIL', 'Athletic':     'ATH', 'Valencia':     'VAL',
  'Osasuna':     'OSA', 'Celta':        'CEL', 'Getafe':       'GET',
  'Rayo':        'RAY', 'Alavés':       'ALA', 'Espanyol':     'ESP',
  'Racing':      'RAC', 'Levante':      'LEV', 'Deportivo':    'DEP',
  'Elche':       'ELC', 'Málaga':       'MAL',
};

const SECTIONS = [
  { key: 'ganadorLiga',   label: 'Campeón de Liga',   pts: '25 pts',     type: 'single' },
  { key: 'champions',     label: 'Champions League',   pts: '10 pts c/u', type: 'multi',  limit: 4 },
  { key: 'uel',           label: 'Europa League',      pts: '7 pts',      type: 'single' },
  { key: 'uecl',          label: 'Conference League',  pts: '5 pts',      type: 'single' },
  { key: 'descenso',      label: 'Descenso',           pts: '10 pts c/u', type: 'multi',  limit: 3 },
  { key: 'mejorPorteria', label: 'Mejor portería',     pts: '15 pts',     type: 'single' },
  { key: 'empatador',     label: 'Más empates',        pts: '10 pts',     type: 'single' },
];

const EMPTY = {
  ganadorLiga: null, champions: [], uel: null, uecl: null,
  descenso: [], mejorPorteria: null, empatador: null,
};

function TeamName({ team }) {
  return (
    <>
      <span className="team-full">{team}</span>
      <span className="team-abbr">{ABBR[team] || team}</span>
    </>
  );
}

function MultiCrestValue({ teams }) {
  if (!teams || teams.length === 0) return <span className="srow-empty">Sin elegir</span>;
  return (
    <div className="srow-multi">
      {teams.map(t => (
        <span key={t} className="srow-multi-item">
          <img className="team-crest" src={crestUrl(t)} alt={t} title={t} />
          <TeamName team={t} />
        </span>
      ))}
    </div>
  );
}

function SingleValue({ team }) {
  if (!team) return <span className="srow-empty">Sin elegir</span>;
  return (
    <span className="srow-single">
      <img className="team-crest" src={crestUrl(team)} alt={team} />
      <TeamName team={team} />
    </span>
  );
}

function TeamPicker({ teams, selected, multi, limit, onToggle }) {
  return (
    <div className="season-picker">
      <div className="team-grid">
        {teams.map(t => {
          const isSelected = multi ? selected.includes(t) : selected === t;
          const atLimit = multi && !isSelected && selected.length >= limit;
          return (
            <button
              key={t}
              className={`team-option${isSelected ? ' selected' : ''}${atLimit ? ' disabled-opt' : ''}`}
              onClick={() => !atLimit && onToggle(t)}
              title={t}
            >
              <img src={crestUrl(t)} alt={t} />
              <span>{t}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function SeasonPredictTab() {
  const { user } = useAuth();
  const { matchdayData, getMatches, loading: matchesLoading } = useMatches();
  const [data, setData]             = useState(EMPTY);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [savedOnce, setSavedOnce]   = useState(false);
  const [loading, setLoading]       = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [editing, setEditing]       = useState(null);
  const [saveError, setSaveError]   = useState(null);

  const teams = [...new Set(
    Object.values(matchdayData).flat().flatMap(m => [m.homeTeam, m.awayTeam])
  )].sort((a, b) => a.localeCompare(b));

  const jornada1Matches = getMatches(1);
  const firstMatchTime = jornada1Matches.length
    ? Math.min(...jornada1Matches.map(m => new Date(m.utcDate).getTime()).filter(Boolean))
    : Infinity;
  const isClosed = Date.now() >= firstMatchTime;

  useEffect(() => {
    if (!user) return;
    getSeasonPrediction(user.uid)
      .then(d => {
        if (d) {
          setData({
            ganadorLiga:   d.ganadorLiga   || null,
            champions:     d.champions     || [],
            uel:           d.uel           || null,
            uecl:          d.uecl          || null,
            descenso:      d.descenso      || [],
            mejorPorteria: d.mejorPorteria || null,
            empatador:     d.empatador     || null,
          });
          setSavedOnce(true);
        }
      })
      .finally(() => setLoading(false));
  }, [user]);

  function toggleSingle(field, team) {
    setData(prev => ({ ...prev, [field]: prev[field] === team ? null : team }));
    setHasChanges(true);
    setSaved(false);
  }

  function toggleMulti(field, limit, team) {
    setData(prev => {
      const list = prev[field] || [];
      if (list.includes(team)) return { ...prev, [field]: list.filter(t => t !== team) };
      if (list.length >= limit) return prev;
      return { ...prev, [field]: [...list, team] };
    });
    setHasChanges(true);
    setSaved(false);
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveSeasonPrediction(user.uid, data);
      setHasChanges(false);
      setSavedOnce(true);
      setSaved(true);
    } catch (err) {
      setSaveError('Error al guardar. Comprueba tu conexión.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  if (loading || matchesLoading) return <LoadingSpinner />;

  return (
    <>
      <p className="season-subtitle">
        {isClosed
          ? 'Cerradas desde el inicio de la Jornada 1.'
          : 'Se cierran al inicio de la Jornada 1.'}
      </p>

      {SECTIONS.map(sec => {
        const value = data[sec.key];
        const isEditing = editing === sec.key;

        let count = null;
        if (sec.type === 'multi') count = (value || []).length;

        return (
          <div key={sec.key} className="season-card">
            <div className="srow">
              <div className="srow-left">
                <span className="srow-label">{sec.label}</span>
                <span className="srow-pts">{sec.pts}</span>
              </div>
              <div className="srow-value">
                {sec.type === 'single' && <SingleValue team={value} />}
                {sec.type === 'multi'  && <MultiCrestValue teams={value} />}
              </div>
              {!isClosed && (
                <button
                  className="srow-edit"
                  onClick={() => setEditing(isEditing ? null : sec.key)}
                >
                  {isEditing ? 'Cerrar' : 'Modificar'}
                </button>
              )}
            </div>

            {isEditing && sec.type === 'single' && (
              <TeamPicker
                teams={teams}
                selected={value}
                multi={false}
                onToggle={t => { toggleSingle(sec.key, t); setEditing(null); }}
              />
            )}
            {isEditing && sec.type === 'multi' && (
              <TeamPicker
                teams={teams}
                selected={value || []}
                multi={true}
                limit={sec.limit}
                onToggle={t => toggleMulti(sec.key, sec.limit, t)}
              />
            )}
          </div>
        );
      })}

      {saveError && (
        <p style={{ color: '#f87171', fontFamily: 'var(--mono)', fontSize: '.75rem', textAlign: 'center', marginBottom: '.5rem' }}>
          {saveError}
        </p>
      )}

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
  );
}
