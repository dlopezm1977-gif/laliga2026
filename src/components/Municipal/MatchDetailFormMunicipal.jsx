import { useState, useEffect } from 'react';
import { getRoster, saveRoster, saveMatchDetail } from '../../lib/municipalDetail';
import LoadingSpinner from '../LoadingSpinner';

const FAVORITE_TEAM = 'ASTON BIRRA';

const GOAL_TYPES = [
  { id: 'normal',  label: 'Gol' },
  { id: 'penalti', label: 'Penalti' },
  { id: 'pp',      label: 'En propia' },
];
const CARD_TYPES = [
  { id: 'amarilla', label: 'Amarilla' },
  { id: 'roja',     label: 'Roja' },
];

const sameName = (a, b) => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();
const label    = p => `${p.dorsal ? `${p.dorsal} · ` : ''}${p.nombre || '(sin nombre)'}`;
const cleanNum = v => (v === '' || v == null ? null : Number(v));

/* ── Jugadores del rival (a mano) ──────────────────────────── */

function RivalPlayers({ rows, setRows, captain, setCaptain }) {
  const update = (i, patch) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <>
      {rows.map((r, i) => (
        <div key={i} className="mdf-row">
          <input className="mdf-num" type="number" min="0" placeholder="#" value={r.dorsal ?? ''}
            onChange={e => update(i, { dorsal: e.target.value })} />
          <input className="mdf-name" type="text" placeholder="Nombre" value={r.nombre}
            onChange={e => update(i, { nombre: e.target.value })} />
          <label className="mdf-flag" title="Portero">
            <input type="checkbox" checked={!!r.portero} onChange={e => update(i, { portero: e.target.checked })} />POR
          </label>
          <label className="mdf-flag" title="Capitán">
            <input type="radio" name="cap-rival" checked={captain === i} onChange={() => setCaptain(i)} />©
          </label>
          <button type="button" className="mdf-del" onClick={() => {
            setRows(rows.filter((_, j) => j !== i));
            if (captain === i) setCaptain(null);
            else if (captain > i) setCaptain(captain - 1);
          }}>✕</button>
        </div>
      ))}
      <button type="button" className="mdf-add" onClick={() => setRows([...rows, { dorsal: '', nombre: '', portero: false }])}>
        + Añadir jugador
      </button>
    </>
  );
}

/* ── Jugadores del Aston Birra (plantilla de la temporada) ─── */

function RosterPlayers({ roster, setRoster, played, setPlayed, captain, setCaptain }) {
  const update = (i, patch) => setRoster(roster.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const toggle = i => {
    const next = new Set(played);
    if (next.has(i)) { next.delete(i); if (captain === i) setCaptain(null); } else next.add(i);
    setPlayed(next);
  };
  return (
    <>
      {roster.length === 0 && (
        <p className="mdf-hint">La plantilla de esta temporada está vacía. Añade jugadores abajo.</p>
      )}
      {roster.map((r, i) => (
        <div key={i} className="mdf-row">
          <input type="checkbox" checked={played.has(i)} onChange={() => toggle(i)} title="Ha jugado" />
          <input className="mdf-num" type="number" min="0" placeholder="#" value={r.dorsal ?? ''}
            onChange={e => update(i, { dorsal: e.target.value })} />
          <input className="mdf-name" type="text" placeholder="Nombre" value={r.nombre}
            onChange={e => update(i, { nombre: e.target.value })} />
          <label className="mdf-flag" title="Portero">
            <input type="checkbox" checked={!!r.portero} onChange={e => update(i, { portero: e.target.checked })} />POR
          </label>
          <label className="mdf-flag" title="Capitán">
            <input type="radio" name="cap-fav" disabled={!played.has(i)} checked={captain === i} onChange={() => setCaptain(i)} />©
          </label>
        </div>
      ))}
      <button type="button" className="mdf-add" onClick={() => setRoster([...roster, { dorsal: '', nombre: '', portero: false }])}>
        + Añadir a la plantilla
      </button>
    </>
  );
}

/* ── Goles / tarjetas ──────────────────────────────────────── */

function EventList({ title, items, setItems, types, options, defaultType }) {
  const update = (i, patch) => setItems(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  return (
    <div className="mdf-section">
      <div className="mdf-title">{title}</div>
      {items.map((it, i) => (
        <div key={i} className="mdf-row mdf-row--wrap">
          <select className="mdf-select" value={it.pid} onChange={e => update(i, { pid: e.target.value })}>
            <option value="">— Jugador —</option>
            {options.map(o => <option key={o.pid} value={o.pid}>{o.text}</option>)}
          </select>
          <select className="mdf-type" value={it.tipo} onChange={e => update(i, { tipo: e.target.value })}>
            {types.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <button type="button" className="mdf-del" onClick={() => setItems(items.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button type="button" className="mdf-add" onClick={() => setItems([...items, { pid: '', tipo: defaultType }])}>
        + Añadir
      </button>
    </div>
  );
}

/* ── Formulario ────────────────────────────────────────────── */

export default function MatchDetailFormMunicipal({ match, season, round, onSaved, onCancel }) {
  const favSide   = match.homeTeam === FAVORITE_TEAM ? 'home' : 'away';
  const rivalSide = favSide === 'home' ? 'away' : 'home';
  const rivalName = match[`${rivalSide}Team`];

  const [ready, setReady]       = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState(null);
  const [roster, setRoster]     = useState([]);
  const [played, setPlayed]     = useState(new Set());
  const [favCaptain, setFavCaptain]     = useState(null);
  const [rival, setRival]       = useState([]);
  const [rivalCaptain, setRivalCaptain] = useState(null);
  const [goals, setGoals]       = useState([]);
  const [cards, setCards]       = useState([]);

  // Carga la plantilla de la temporada y rellena el formulario con el detalle existente
  useEffect(() => {
    let cancelled = false;
    getRoster(season).then(saved => {
      if (cancelled) return;
      const ros = saved.map(p => ({ ...p }));
      const d   = match.detail;
      const idxIn = (list, p) => list.findIndex(r => sameName(r.nombre, p.nombre) && String(r.dorsal ?? '') === String(p.dorsal ?? ''));

      const playedSet = new Set();
      let capFav = null;
      for (const p of d?.[favSide] ?? []) {
        let i = idxIn(ros, p);
        if (i < 0) { ros.push({ dorsal: p.dorsal ?? '', nombre: p.nombre, portero: !!p.portero }); i = ros.length - 1; }
        playedSet.add(i);
        if (p.capitan) capFav = i;
      }
      const rivalRows = (d?.[rivalSide] ?? []).map(p => ({ dorsal: p.dorsal ?? '', nombre: p.nombre, portero: !!p.portero }));
      const capRival  = (d?.[rivalSide] ?? []).findIndex(p => p.capitan);

      const toPid = e => {
        const list = e.team === favSide ? ros : rivalRows;
        const i = idxIn(list, e);
        return i < 0 ? '' : `${e.team}|${i}`;
      };
      setRoster(ros);
      setPlayed(playedSet);
      setFavCaptain(capFav);
      setRival(rivalRows);
      setRivalCaptain(capRival >= 0 ? capRival : null);
      setGoals((d?.goals ?? []).map(g => ({ pid: toPid(g), tipo: g.tipo ?? 'normal' })));
      setCards((d?.cards ?? []).map(c => ({ pid: toPid(c), tipo: c.tipo ?? 'amarilla' })));
      setReady(true);
    }).catch(err => { if (!cancelled) { setError(err.message); setReady(true); } });
    return () => { cancelled = true; };
  }, [season, match, favSide, rivalSide]);

  // Opciones para goles/tarjetas: jugadores marcados del Aston + filas con nombre del rival
  const options = [
    ...roster.map((p, i) => ({ p, i })).filter(({ i }) => played.has(i))
      .map(({ p, i }) => ({ pid: `${favSide}|${i}`, text: `${label(p)} (${FAVORITE_TEAM})` })),
    ...rival.map((p, i) => ({ p, i })).filter(({ p }) => p.nombre.trim())
      .map(({ p, i }) => ({ pid: `${rivalSide}|${i}`, text: `${label(p)} (${rivalName})` })),
  ];

  function resolve(pid) {
    const [team, idx] = pid.split('|');
    const p = (team === favSide ? roster : rival)[Number(idx)];
    return p ? { team, dorsal: cleanNum(p.dorsal), nombre: p.nombre.trim() } : null;
  }

  async function handleSave() {
    const cleanRoster = roster
      .filter(p => p.nombre.trim())
      .map(p => ({ dorsal: cleanNum(p.dorsal), nombre: p.nombre.trim(), portero: !!p.portero }));

    const mapPlayer = (p, capitan) => ({
      dorsal: cleanNum(p.dorsal), nombre: p.nombre.trim(), portero: !!p.portero, capitan,
    });
    const favPlayers = roster
      .map((p, i) => ({ p, i }))
      .filter(({ p, i }) => played.has(i) && p.nombre.trim())
      .map(({ p, i }) => mapPlayer(p, favCaptain === i));
    const rivalPlayers = rival
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => p.nombre.trim())
      .map(({ p, i }) => mapPlayer(p, rivalCaptain === i));

    const detail = {
      [favSide]:   favPlayers,
      [rivalSide]: rivalPlayers,
      goals: goals.filter(g => g.pid)
        .map(g => ({ ...resolve(g.pid), tipo: g.tipo }))
        .filter(g => g.nombre),
      cards: cards.filter(c => c.pid).map(c => ({ ...resolve(c.pid), tipo: c.tipo })).filter(c => c.nombre),
    };

    setSaving(true);
    setError(null);
    try {
      await saveRoster(season, cleanRoster);
      await saveMatchDetail(season, round, match, detail);
      onSaved(detail);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  if (!ready) return <LoadingSpinner text="Cargando plantilla…" />;

  return (
    <div className="mdf">
      <div className="mdf-section">
        <div className="mdf-title">{FAVORITE_TEAM} · jugadores del acta</div>
        <RosterPlayers
          roster={roster} setRoster={setRoster}
          played={played} setPlayed={setPlayed}
          captain={favCaptain} setCaptain={setFavCaptain}
        />
      </div>

      <div className="mdf-section">
        <div className="mdf-title">{rivalName} · jugadores del acta</div>
        <RivalPlayers rows={rival} setRows={setRival} captain={rivalCaptain} setCaptain={setRivalCaptain} />
      </div>

      <EventList title="⚽ Goles" items={goals} setItems={setGoals} types={GOAL_TYPES} options={options} defaultType="normal" />
      <EventList title="🟨🟥 Tarjetas" items={cards} setItems={setCards} types={CARD_TYPES} options={options} defaultType="amarilla" />

      {error && <p className="mdf-error">{error}</p>}

      <div className="mdf-actions">
        <button type="button" className="mdf-cancel" onClick={onCancel} disabled={saving}>Cancelar</button>
        <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar detalle'}
        </button>
      </div>
    </div>
  );
}
