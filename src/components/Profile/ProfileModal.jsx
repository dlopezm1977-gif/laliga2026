import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useMatches } from '../../hooks/useMatches';
import { crestUrl } from '../../lib/crests';

export default function ProfileModal({ onClose }) {
  const { profile, updateProfile } = useAuth();
  const { matchdayData } = useMatches();

  const [username, setUsername] = useState(profile?.username || '');
  const [favoriteTeam, setFavoriteTeam] = useState(profile?.favoriteTeam || null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const teams = [...new Set(
    Object.values(matchdayData).flat().flatMap(m => [m.homeTeam, m.awayTeam])
  )].sort((a, b) => a.localeCompare(b));

  async function handleSave() {
    if (!username.trim()) return;
    setSaving(true);
    setSaved(false);
    await updateProfile({ username: username.trim(), favoriteTeam: favoriteTeam || null });
    setSaving(false);
    setSaved(true);
    setTimeout(onClose, 800);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Mi perfil</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <label className="modal-label">
          Nombre / Nickname
          <input
            className="modal-input"
            value={username}
            maxLength={30}
            onChange={e => { setUsername(e.target.value); setSaved(false); }}
          />
        </label>

        <div className="modal-label">
          Equipo favorito
          {favoriteTeam && (
            <button className="team-clear" onClick={() => { setFavoriteTeam(null); setSaved(false); }}>
              Quitar
            </button>
          )}
        </div>
        <div className="team-grid">
          {teams.map(t => (
            <button
              key={t}
              className={`team-option${favoriteTeam === t ? ' selected' : ''}`}
              onClick={() => { setFavoriteTeam(t); setSaved(false); }}
              title={t}
            >
              <img src={crestUrl(t)} alt={t} />
              <span>{t}</span>
            </button>
          ))}
        </div>

        <button className="btn-save" onClick={handleSave} disabled={saving || !username.trim()}>
          {saving ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}
