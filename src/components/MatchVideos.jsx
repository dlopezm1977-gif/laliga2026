import { useState, useEffect } from 'react';
import { getMatchVideos, saveMatchVideos, VIDEO_TYPES } from '../lib/matchVideos';

const EMPTY = { tipo: 'gol', label: '', url: '' };

export default function MatchVideos({ videoKey, canEdit }) {
  const [videos, setVideos]   = useState([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState([]);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!videoKey) return;
    let cancelled = false;
    setVideos([]);
    getMatchVideos(videoKey).then(v => { if (!cancelled) setVideos(v); }).catch(() => {});
    return () => { cancelled = true; };
  }, [videoKey]);

  if (!videoKey || (!videos.length && !canEdit)) return null;

  const update = (i, patch) => setDraft(draft.map((v, j) => (j === i ? { ...v, ...patch } : v)));

  async function handleSave() {
    const clean = draft
      .map(v => ({ tipo: v.tipo, label: v.label.trim(), url: v.url.trim() }))
      .filter(v => v.url);
    setSaving(true);
    setError(null);
    try {
      await saveMatchVideos(videoKey, clean);
      setVideos(clean);
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="md-section">
      {!editing && VIDEO_TYPES.map(t => {
        const list = videos.filter(v => (v.tipo ?? 'gol') === t.id);
        return list.length > 0 && (
          <div key={t.id}>
            <h4 className="md-section-title">{t.title}</h4>
            {list.map((v, i) => (
              <a key={i} href={v.url} target="_blank" rel="noopener noreferrer" className="md-video-link">
                ▶ {v.label || (t.id === 'gol' ? 'Ver gol' : 'Ver ocasión')}
              </a>
            ))}
          </div>
        );
      })}

      {!editing && canEdit && (
        <div>
          <button type="button" className="mdf-edit-btn" onClick={() => {
            setDraft(videos.length ? videos.map(v => ({ ...EMPTY, ...v })) : [{ ...EMPTY }]);
            setEditing(true);
          }}>
            ✏️ {videos.length ? 'Editar vídeos' : 'Añadir vídeos'}
          </button>
        </div>
      )}

      {editing && (
        <div className="mdf" style={{ padding: 0 }}>
          <h4 className="md-section-title">Vídeos</h4>
          {draft.map((v, i) => (
            <div key={i} className="mdf-row mdf-row--wrap">
              <select className="mdf-type" value={v.tipo} onChange={e => update(i, { tipo: e.target.value })}>
                {VIDEO_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              <input className="mdf-name" type="text" placeholder="Descripción (ej. Gol de Pepe, min 23)" value={v.label}
                onChange={e => update(i, { label: e.target.value })} />
              <button type="button" className="mdf-del" onClick={() => setDraft(draft.filter((_, j) => j !== i))}>✕</button>
              <input className="mdf-video" type="url" placeholder="Enlace de YouTube" value={v.url}
                onChange={e => update(i, { url: e.target.value })} />
            </div>
          ))}
          <button type="button" className="mdf-add" onClick={() => setDraft([...draft, { ...EMPTY }])}>+ Añadir</button>
          {error && <p className="mdf-error">{error}</p>}
          <div className="mdf-actions">
            <button type="button" className="mdf-cancel" onClick={() => setEditing(false)} disabled={saving}>Cancelar</button>
            <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
