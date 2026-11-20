import { useState, useEffect, useMemo } from 'react';
import { LEAGUES, loadMatches, getHighlights, saveHighlights, thumbnailFromUrl } from '../../lib/adminData';
import LoadingSpinner from '../LoadingSpinner';

const MAX_LIST = 40;
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const fmtDate = utc => (utc
  ? new Date(utc).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'Europe/Madrid' })
  : '');

function HighlightEditor({ league, match, onClose }) {
  const [items, setItems]   = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState(null);

  useEffect(() => {
    let cancelled = false;
    getHighlights(league, match.matchId)
      .then(h => { if (!cancelled) setItems(h.map(x => ({ ...x }))); })
      .catch(e => { if (!cancelled) { setError(e.message); setItems([]); } });
    return () => { cancelled = true; };
  }, [league, match.matchId]);

  const update = (i, patch) => { setSaved(false); setItems(items.map((it, j) => (j === i ? { ...it, ...patch } : it))); };
  // Al cambiar la URL se recalcula la miniatura (sigue siendo editable a mano)
  const setUrl = (i, url) => update(i, { url, thumbnail: thumbnailFromUrl(url) || items[i].thumbnail || '' });
  const makeFirst = i => { setSaved(false); setItems([items[i], ...items.filter((_, j) => j !== i)]); };
  const add = () => {
    setSaved(false);
    setItems([...items, {
      kind: 'full',
      title: `${match.homeTeam} ${match.homeScore ?? ''}-${match.awayScore ?? ''} ${match.awayTeam} — Highlights`,
      url: '', thumbnail: '', published_at: new Date().toISOString(),
    }]);
  };

  async function handleSave() {
    const clean = items
      .map(it => ({ ...it, url: (it.url ?? '').trim(), thumbnail: (it.thumbnail ?? '').trim(), title: (it.title ?? '').trim() }))
      .filter(it => it.url);
    setSaving(true); setError(null);
    try {
      await saveHighlights(league, match.matchId, clean);
      setItems(clean); setSaved(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (!items) return <LoadingSpinner text="Cargando vídeos…" />;

  return (
    <div className="adm-editor">
      <div className="mdf-title">
        {match.homeTeam} {match.homeScore ?? ''}–{match.awayScore ?? ''} {match.awayTeam}
        <span className="adm-sub"> · J{match.round} · id {match.matchId}</span>
      </div>
      <p className="mdf-hint">En la app se muestra el primero de la lista. Pega la URL de YouTube y la miniatura se calcula sola.</p>

      {items.length === 0 && <p className="mdf-hint">Este partido no tiene vídeos guardados.</p>}
      {items.map((it, i) => (
        <div key={i} className="adm-hl">
          <div className="mdf-row">
            <input className="mdf-name" type="text" placeholder="Título" value={it.title ?? ''}
              onChange={e => update(i, { title: e.target.value })} />
            {i > 0 && <button type="button" className="mdf-add" onClick={() => makeFirst(i)} title="Mostrar este">↑ Primero</button>}
            <button type="button" className="mdf-del" onClick={() => { setSaved(false); setItems(items.filter((_, j) => j !== i)); }}>✕</button>
          </div>
          <div className="mdf-row">
            <input className="mdf-name" type="text" placeholder="URL del vídeo (YouTube)" value={it.url ?? ''}
              onChange={e => setUrl(i, e.target.value)} />
          </div>
          <div className="mdf-row">
            <input className="mdf-name" type="text" placeholder="Miniatura (thumbnail)" value={it.thumbnail ?? ''}
              onChange={e => update(i, { thumbnail: e.target.value })} />
            {it.thumbnail && <img className="adm-thumb" src={it.thumbnail} alt="" />}
          </div>
        </div>
      ))}

      <button type="button" className="mdf-add" onClick={add}>+ Añadir vídeo</button>

      {error && <p className="mdf-error">{error}</p>}
      <div className="mdf-actions">
        <button type="button" className="mdf-cancel" onClick={onClose} disabled={saving}>Cerrar</button>
        <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar vídeos'}
        </button>
      </div>
    </div>
  );
}

export default function AdminVideosTab() {
  const [league, setLeague]     = useState('laliga');
  const [team, setTeam]         = useState('Sevilla');
  const [matches, setMatches]   = useState(null);
  const [error, setError]       = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setMatches(null); setSelected(null); setError(null);
    loadMatches(league)
      .then(m => { if (!cancelled) setMatches(m); })
      .catch(e => { if (!cancelled) { setError(e.message); setMatches([]); } });
    return () => { cancelled = true; };
  }, [league]);

  const filtered = useMemo(() => {
    const q = norm(team.trim());
    return (matches ?? [])
      .filter(m => m.status === 'finished')
      .filter(m => !q || norm(m.homeTeam).includes(q) || norm(m.awayTeam).includes(q));
  }, [matches, team]);

  return (
    <div className="adm">
      <div className="adm-toolbar">
        {Object.entries(LEAGUES).map(([id, l]) => (
          <button key={id} type="button" className={`notif-scope-btn${league === id ? ' active' : ''}`} onClick={() => setLeague(id)}>
            {l.label}
          </button>
        ))}
        <input className="adm-filter" type="text" placeholder="Filtrar por equipo" value={team} onChange={e => setTeam(e.target.value)} />
      </div>

      {error && <p className="mdf-error">{error}</p>}
      {!matches ? <LoadingSpinner text="Cargando partidos…" /> : (
        <>
          {filtered.length === 0 && <p className="mdf-hint">No hay partidos finalizados con ese filtro.</p>}
          <div className="adm-list">
            {filtered.slice(0, MAX_LIST).map(m => (
              <div key={m.matchId}>
                <button type="button" className={`adm-match${selected?.matchId === m.matchId ? ' active' : ''}`}
                  onClick={() => setSelected(selected?.matchId === m.matchId ? null : m)}>
                  <span className="adm-sub">{fmtDate(m.utcDate)} · J{m.round}</span>
                  <span>{m.homeTeam} {m.homeScore}–{m.awayScore} {m.awayTeam}</span>
                </button>
                {selected?.matchId === m.matchId && (
                  <HighlightEditor league={league} match={m} onClose={() => setSelected(null)} />
                )}
              </div>
            ))}
          </div>
          {filtered.length > MAX_LIST && <p className="mdf-hint">Mostrando {MAX_LIST} de {filtered.length}. Afina el filtro.</p>}
        </>
      )}
    </div>
  );
}
