import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useMatches } from '../../hooks/useMatches';
import { crestUrl } from '../../lib/crests';
import { AVATARS } from '../../lib/avatars';

export default function ProfileModal({ onClose }) {
  const { profile, updateProfile } = useAuth();
  const { matchdayData } = useMatches();

  const [username, setUsername] = useState(profile?.username || '');
  const [favoriteTeam, setFavoriteTeam] = useState(profile?.favoriteTeam || null);
  const [avatar, setAvatar] = useState(profile?.avatar || null);
  const [showAvatarPicker, setShowAvatarPicker] = useState(!profile?.avatar);
  const [showTeamPicker, setShowTeamPicker] = useState(!profile?.favoriteTeam);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const teams = [...new Set(
    Object.values(matchdayData).flat().flatMap(m => [m.homeTeam, m.awayTeam])
  )].sort((a, b) => a.localeCompare(b));

  function selectAvatar(file) {
    setAvatar(file);
    setShowAvatarPicker(false);
    setSaved(false);
  }

  function clearAvatar() {
    setAvatar(null);
    setShowAvatarPicker(true);
    setSaved(false);
  }

  function selectTeam(t) {
    setFavoriteTeam(t);
    setShowTeamPicker(false);
    setSaved(false);
  }

  function clearTeam() {
    setFavoriteTeam(null);
    setShowTeamPicker(true);
    setSaved(false);
  }

  async function handleSave() {
    if (!username.trim()) return;
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      await updateProfile({ username: username.trim(), favoriteTeam: favoriteTeam || null, avatar: avatar || null });
      setSaved(true);
      setTimeout(onClose, 800);
    } catch (err) {
      setError(err.code === 'auth/username-already-in-use'
        ? 'Ese nombre ya está en uso, elige otro.'
        : 'Error al guardar. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
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

        {/* ── Avatar ── */}
        <div className="modal-label" style={{ marginTop: '.8rem' }}>Avatar</div>
        {avatar && !showAvatarPicker ? (
          <div className="selection-preview">
            <img
              className="selection-preview-avatar"
              src={`${import.meta.env.BASE_URL}avatars/${avatar}`}
              alt="avatar"
            />
            <button className="team-clear" onClick={() => setShowAvatarPicker(true)}>Cambiar</button>
            <button className="team-clear" onClick={clearAvatar}>Quitar</button>
          </div>
        ) : (
          <div className="avatar-picker">
            {AVATARS.map(file => (
              <button
                key={file}
                className={`avatar-option${avatar === file ? ' selected' : ''}`}
                onClick={() => selectAvatar(file)}
                title={file.replace(/\.[^.]+$/, '')}
              >
                <img src={`${import.meta.env.BASE_URL}avatars/${file}`} alt={file} />
              </button>
            ))}
          </div>
        )}

        {/* ── Equipo favorito ── */}
        <div className="modal-label" style={{ marginTop: '.8rem' }}>Equipo favorito</div>
        {favoriteTeam && !showTeamPicker ? (
          <div className="selection-preview">
            <img className="selection-preview-crest" src={crestUrl(favoriteTeam)} alt={favoriteTeam} />
            <span className="selection-preview-name">{favoriteTeam}</span>
            <button className="team-clear" onClick={() => setShowTeamPicker(true)}>Cambiar</button>
            <button className="team-clear" onClick={clearTeam}>Quitar</button>
          </div>
        ) : (
          <div className="team-grid">
            {teams.map(t => (
              <button
                key={t}
                className={`team-option${favoriteTeam === t ? ' selected' : ''}`}
                onClick={() => selectTeam(t)}
                title={t}
              >
                <img src={crestUrl(t)} alt={t} />
                <span>{t}</span>
              </button>
            ))}
          </div>
        )}

        {error && <div className="auth-error">{error}</div>}
        <button className="btn-save" onClick={handleSave} disabled={saving || !username.trim()}>
          {saving ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}
