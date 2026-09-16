import { useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useMatches } from '../../hooks/useMatches';
import { useMatchesSegunda } from '../../hooks/useMatchesSegunda';
import { crestUrl, crestUrlSegunda } from '../../lib/crests';
import { canonicalize } from '../../lib/segundaTeams';
import { AVATARS } from '../../lib/avatars';
import MySchedule from './MySchedule';

export default function ProfileModal({ onClose }) {
  const { profile, updateProfile } = useAuth();
  const { matchdayData } = useMatches();
  const { roundData: roundDataSegunda } = useMatchesSegunda();

  const [username, setUsername]                       = useState(profile?.username || '');
  const [favoriteTeam, setFavoriteTeam]               = useState(profile?.favoriteTeam || null);
  const [favoriteTeamSegunda, setFavoriteTeamSegunda] = useState(profile?.favoriteTeamSegunda || null);
  const [avatar, setAvatar]                           = useState(profile?.avatar || null);
  const [showAvatarPicker, setShowAvatarPicker]       = useState(!profile?.avatar);
  const [carouselIdx, setCarouselIdx]                 = useState(() => {
    const idx = profile?.avatar ? AVATARS.indexOf(profile.avatar) : 0;
    return idx >= 0 ? idx : 0;
  });
  const [showTeamPicker, setShowTeamPicker]           = useState(!profile?.favoriteTeam);
  const [showTeamPickerSegunda, setShowTeamPickerSegunda] = useState(!profile?.favoriteTeamSegunda);
  const [saving, setSaving]                           = useState(false);
  const [saved, setSaved]                             = useState(false);
  const [error, setError]                             = useState('');

  const teams = useMemo(() => [...new Set(
    Object.values(matchdayData).flat().flatMap(m => [m.homeTeam, m.awayTeam])
  )].sort((a, b) => a.localeCompare(b)), [matchdayData]);

  const teamsSegunda = useMemo(() => [...new Set(
    Object.values(roundDataSegunda).flat().flatMap(m => [canonicalize(m.homeTeam), canonicalize(m.awayTeam)])
  )].filter(Boolean).sort((a, b) => a.localeCompare(b)), [roundDataSegunda]);

  function selectAvatar(file) { setAvatar(file); setShowAvatarPicker(false); setSaved(false); }
  function clearAvatar()      { setAvatar(null);  setShowAvatarPicker(true);  setSaved(false); }
  function selectTeam(t)          { setFavoriteTeam(t);        setShowTeamPicker(false);        setSaved(false); }
  function clearTeam()            { setFavoriteTeam(null);     setShowTeamPicker(true);         setSaved(false); }
  function selectTeamSegunda(t)   { setFavoriteTeamSegunda(t); setShowTeamPickerSegunda(false); setSaved(false); }
  function clearTeamSegunda()     { setFavoriteTeamSegunda(null); setShowTeamPickerSegunda(true); setSaved(false); }

  async function handleSave() {
    if (!username.trim()) return;
    setSaving(true); setSaved(false); setError('');
    try {
      await updateProfile({
        username: username.trim(),
        favoriteTeam: favoriteTeam || null,
        favoriteTeamSegunda: favoriteTeamSegunda || null,
        avatar: avatar || null,
      });
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
          <div className="avatar-carousel-wrap">
            <div className="avatar-carousel">
              <button
                className="avatar-carousel-btn"
                onClick={() => setCarouselIdx(i => (i - 1 + AVATARS.length) % AVATARS.length)}
              >‹</button>
              <img
                className="avatar-carousel-img"
                src={`${import.meta.env.BASE_URL}avatars/${AVATARS[carouselIdx]}`}
                alt="avatar"
              />
              <button
                className="avatar-carousel-btn"
                onClick={() => setCarouselIdx(i => (i + 1) % AVATARS.length)}
              >›</button>
            </div>
            <div className="avatar-carousel-counter">{carouselIdx + 1} / {AVATARS.length}</div>
            <button className="btn-save" style={{ marginTop: '.5rem' }} onClick={() => selectAvatar(AVATARS[carouselIdx])}>
              Seleccionar
            </button>
          </div>
        )}

        {/* ── Equipo favorito (Primera) ── */}
        <div className="modal-label" style={{ marginTop: '.8rem' }}>Equipo favorito · LaLiga</div>
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

        {/* ── Equipo favorito (Segunda) ── */}
        <div className="modal-label" style={{ marginTop: '.8rem' }}>Equipo favorito · 2ª División</div>
        {favoriteTeamSegunda && !showTeamPickerSegunda ? (
          <div className="selection-preview">
            <img className="selection-preview-crest" src={crestUrlSegunda(favoriteTeamSegunda)} alt={favoriteTeamSegunda} />
            <span className="selection-preview-name">{favoriteTeamSegunda}</span>
            <button className="team-clear" onClick={() => setShowTeamPickerSegunda(true)}>Cambiar</button>
            <button className="team-clear" onClick={clearTeamSegunda}>Quitar</button>
          </div>
        ) : (
          <div className="team-grid">
            {teamsSegunda.map(t => (
              <button
                key={t}
                className={`team-option${favoriteTeamSegunda === t ? ' selected' : ''}`}
                onClick={() => selectTeamSegunda(t)}
                title={t}
              >
                <img src={crestUrlSegunda(t)} alt={t} />
                <span>{t}</span>
              </button>
            ))}
          </div>
        )}

        {error && <div className="auth-error">{error}</div>}
        <button className="btn-save" onClick={handleSave} disabled={saving || !username.trim()}>
          {saving ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar'}
        </button>

        {/* ── Calendario de partidos ── */}
        <div className="sched-divider" />
        <MySchedule
          matchdayData={matchdayData}
          roundDataSegunda={roundDataSegunda}
          favoriteTeam={favoriteTeam}
          favoriteTeamSegunda={favoriteTeamSegunda}
        />
      </div>
    </div>
  );
}
