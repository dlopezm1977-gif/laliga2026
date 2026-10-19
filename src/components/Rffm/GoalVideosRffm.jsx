import { useState, useEffect } from 'react';
import { getRffmVideos, saveRffmVideos } from '../../lib/rffmVideos';

export default function GoalVideosRffm({ matchId, canEdit }) {
  const [videos, setVideos]   = useState([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState([]);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!matchId) return;
    let cancelled = false;
    setVideos([]);
    getRffmVideos(matchId).then(v => { if (!cancelled) setVideos(v); }).catch(() => {});
    return () => { cancelled = true; };
  }, [matchId]);

  if (!matchId || (!videos.length && !canEdit)) return null;

  const update = (i, patch) => setDraft(draft.map((v, j) => (j === i ? { ...v, ...patch } : v)));

  async function handleSave() {
    const clean = draft
      .map(v => ({ label: v.label.trim(), url: v.url.trim() }))
      .filter(v => v.url);
    setSaving(true);
    setError(null);
    try {
      await saveRffmVideos(matchId, clean);
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
      <h4 className="md-section-title">Vídeos de goles</h4>

      {!editing && videos.map((v, i) => (
        <a key={i} href={v.url} target="_blank" rel="noopener noreferrer" className="md-video-link">
          ▶ {v.label || 'Ver gol'}
        </a>
      ))}

      {!editing && canEdit && (
        <div style={{ marginTop: '.5rem' }}>
          <button type="button" className="mdf-edit-btn" onClick={() => {
            setDraft(videos.length ? videos.map(v => ({ ...v })) : [{ label: '', url: '' }]);
            setEditing(true);
          }}>
            ✏️ {videos.length ? 'Editar vídeos' : 'Añadir vídeos'}
          </button>
        </div>
      )}

      {editing && (
        <div className="mdf" style={{ padding: '.5rem 0 0' }}>
          {draft.map((v, i) => (
            <div key={i} className="mdf-row mdf-row--wrap">
              <input className="mdf-name" type="text" placeholder="Descripción (ej. Gol de Pepe, min 23)" value={v.label}
                onChange={e => update(i, { label: e.target.value })} />
              <button type="button" className="mdf-del" onClick={() => setDraft(draft.filter((_, j) => j !== i))}>✕</button>
              <input className="mdf-video" type="url" placeholder="Enlace de YouTube" value={v.url}
                onChange={e => update(i, { url: e.target.value })} />
            </div>
          ))}
          <button type="button" className="mdf-add" onClick={() => setDraft([...draft, { label: '', url: '' }])}>+ Añadir</button>
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
