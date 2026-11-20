import { useState, useEffect } from 'react';
import { SEASON_MONTHS, MONTHLY_CATEGORIES } from '../../lib/months';
import { crestUrl } from '../../lib/crests';
import {
  loadMatches, getMonthlyResult, saveMonthlyResult, getSeasonResultsDoc, saveSeasonResultsDoc,
} from '../../lib/adminData';
import LoadingSpinner from '../LoadingSpinner';

// Mismas categorías y claves que las predicciones anuales (SeasonPredictTab / AnnualRankingTab)
const ANNUAL_SECTIONS = [
  { key: 'ganadorLiga',   label: '🏆 Campeón de Liga',  type: 'single' },
  { key: 'champions',     label: '⭐ Champions League',  type: 'multi', limit: 4 },
  { key: 'uel',           label: '🟠 Europa League',     type: 'single' },
  { key: 'uecl',          label: '🟢 Conference League', type: 'single' },
  { key: 'descenso',      label: '⬇️ Descenso',          type: 'multi', limit: 3 },
  { key: 'mejorPorteria', label: '🧤 Mejor portería',    type: 'single' },
  { key: 'empatador',     label: '⚖️ Más empates',       type: 'single' },
];

/* ── Mensuales ─────────────────────────────────────────────── */

function MonthlyForm({ teams }) {
  const [month, setMonth]   = useState(() => {
    // Mes en curso (o el último de la temporada) por defecto
    const now = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' }).split('-').map(Number);
    return (SEASON_MONTHS.find(m => m.year === now[0] && m.month === now[1]) ?? SEASON_MONTHS[SEASON_MONTHS.length - 1]).key;
  });
  const [values, setValues] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState(null);

  useEffect(() => {
    let cancelled = false;
    setValues(null); setSaved(false); setError(null);
    getMonthlyResult(month).then(d => {
      if (cancelled) return;
      const v = {};
      for (const c of MONTHLY_CATEGORIES) v[c.key] = { name: d[c.key]?.name ?? '', team: d[c.key]?.team ?? '' };
      setValues(v);
    }).catch(e => { if (!cancelled) { setError(e.message); setValues({}); } });
    return () => { cancelled = true; };
  }, [month]);

  const set = (key, patch) => { setSaved(false); setValues(v => ({ ...v, [key]: { ...v[key], ...patch } })); };

  async function handleSave() {
    const data = {};
    for (const c of MONTHLY_CATEGORIES) {
      const name = (values[c.key]?.name ?? '').trim();
      const team = values[c.key]?.team ?? '';
      if (name && !team) { setError(`${c.label}: elige el equipo (sin equipo no puntúa).`); return; }
      data[c.key] = name || team ? { name, team } : null;
    }
    setSaving(true); setError(null);
    try { await saveMonthlyResult(month, data); setSaved(true); }
    catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="mdf-section">
      <div className="mdf-row">
        <select className="mdf-select" value={month} onChange={e => setMonth(e.target.value)}>
          {SEASON_MONTHS.map(m => <option key={m.key} value={m.key}>{m.label} {m.year}</option>)}
        </select>
      </div>

      {!values ? <LoadingSpinner text="Cargando…" /> : MONTHLY_CATEGORIES.map(c => {
        const cur = values[c.key] ?? { name: '', team: '' };
        const options = cur.team && !teams.includes(cur.team) ? [cur.team, ...teams] : teams;
        return (
          <div key={c.key} className="adm-hl">
            <div className="mdf-title">{c.emoji} {c.label}</div>
            <div className="mdf-row">
              <input className="mdf-name" type="text" placeholder="Nombre" value={cur.name}
                onChange={e => set(c.key, { name: e.target.value })} />
              <select className="mdf-select" value={cur.team} onChange={e => set(c.key, { team: e.target.value })}>
                <option value="">— Equipo —</option>
                {options.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        );
      })}

      {error && <p className="mdf-error">{error}</p>}
      <div className="mdf-actions">
        <button type="button" className="btn-primary" onClick={handleSave} disabled={saving || !values}>
          {saving ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar premios del mes'}
        </button>
      </div>
    </div>
  );
}

/* ── Anuales ───────────────────────────────────────────────── */

function AnnualForm({ teams }) {
  const [values, setValues] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState(null);

  useEffect(() => {
    getSeasonResultsDoc().then(d => {
      const v = {};
      for (const s of ANNUAL_SECTIONS) v[s.key] = s.type === 'multi' ? (d[s.key] ?? []) : (d[s.key] ?? null);
      setValues(v);
    }).catch(e => { setError(e.message); setValues({}); });
  }, []);

  const toggle = (sec, team) => {
    setSaved(false);
    setValues(v => {
      if (sec.type === 'single') return { ...v, [sec.key]: v[sec.key] === team ? null : team };
      const cur = v[sec.key] ?? [];
      if (cur.includes(team)) return { ...v, [sec.key]: cur.filter(t => t !== team) };
      return cur.length >= sec.limit ? v : { ...v, [sec.key]: [...cur, team] };
    });
  };

  async function handleSave() {
    setSaving(true); setError(null);
    try { await saveSeasonResultsDoc(values); setSaved(true); }
    catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  if (!values) return <LoadingSpinner text="Cargando…" />;

  return (
    <div className="mdf-section">
      <p className="mdf-hint">Marca los equipos que ya están decididos y deja vacío el resto. Pulsa de nuevo un equipo para quitarlo.</p>
      {ANNUAL_SECTIONS.map(sec => {
        const sel = sec.type === 'multi' ? (values[sec.key] ?? []) : [values[sec.key]].filter(Boolean);
        return (
          <div key={sec.key} className="adm-hl">
            <div className="mdf-title">
              {sec.label}{sec.type === 'multi' && <span className="adm-sub"> · {sel.length}/{sec.limit}</span>}
            </div>
            <div className="team-grid">
              {teams.map(t => (
                <button key={t} type="button" className={`team-option${sel.includes(t) ? ' selected' : ''}`}
                  onClick={() => toggle(sec, t)} title={t}>
                  <img src={crestUrl(t)} alt={t} />
                  <span>{t}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {error && <p className="mdf-error">{error}</p>}
      <div className="mdf-actions">
        <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar premios anuales'}
        </button>
      </div>
    </div>
  );
}

/* ── Pestaña ───────────────────────────────────────────────── */

export default function AdminPrizesTab() {
  const [mode, setMode]   = useState('mensual');
  const [teams, setTeams] = useState(null);

  // Equipos de Primera tal y como aparecen en las predicciones (nombres de matches_cache)
  useEffect(() => {
    loadMatches('laliga')
      .then(ms => setTeams([...new Set(ms.flatMap(m => [m.homeTeam, m.awayTeam]))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'es'))))
      .catch(() => setTeams([]));
  }, []);

  return (
    <div className="adm">
      <div className="adm-toolbar">
        <button type="button" className={`notif-scope-btn${mode === 'mensual' ? ' active' : ''}`} onClick={() => setMode('mensual')}>Mensuales</button>
        <button type="button" className={`notif-scope-btn${mode === 'anual' ? ' active' : ''}`} onClick={() => setMode('anual')}>Anuales</button>
      </div>
      {!teams ? <LoadingSpinner text="Cargando equipos…" />
        : mode === 'mensual' ? <MonthlyForm teams={teams} /> : <AnnualForm teams={teams} />}
    </div>
  );
}
