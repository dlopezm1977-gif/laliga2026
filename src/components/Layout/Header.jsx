import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';
import { useTheme } from '../../hooks/useTheme';
import { crestUrl } from '../../lib/crests';
import ProfileModal from '../Profile/ProfileModal';
import InstructionsModal from '../Auth/InstructionsModal';
import { version } from '../../../package.json';

function initials(name) {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function InstallBanner({ onDismiss, isIos }) {
  return (
    <div className="ios-install-banner">
      <div className="ios-install-steps">
        {isIos ? (
          <>
            <span>Para instalar la app:</span>
            <span>1· Pulsa el botón <strong>Compartir</strong> <span className="ios-share-icon">⎙</span> (barra inferior)</span>
            <span>2· Selecciona <strong>"Añadir a pantalla de inicio"</strong></span>
          </>
        ) : (
          <>
            <span>Para instalar la app:</span>
            <span>1· Pulsa el menú <strong>⋮</strong> de Chrome (esquina superior derecha)</span>
            <span>2· Selecciona <strong>"Añadir a pantalla de inicio"</strong></span>
          </>
        )}
      </div>
      <button className="ios-install-dismiss" onClick={onDismiss} aria-label="Cerrar">✕</button>
    </div>
  );
}

function LeagueDropdown({ current, onChange, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div className="league-dropdown" ref={ref}>
      <button
        className={`league-option${current === 'primera' ? ' active' : ''}`}
        onClick={() => { onChange('primera'); onClose(); }}
      >
        <img src={`${import.meta.env.BASE_URL}laliga-logo.png`} alt="LaLiga" className="league-option-logo" />
        <div>
          <span className="league-option-name">LaLiga EA Sports</span>
          <span className="league-option-sub">Primera División</span>
        </div>
      </button>
      <button
        className={`league-option${current === 'segunda' ? ' active' : ''}`}
        onClick={() => { onChange('segunda'); onClose(); }}
      >
        <span className="hm-logo-wrap"><img src={`${import.meta.env.BASE_URL}hypermotion-logo.png`} alt="Hypermotion" className="league-option-logo" /></span>
        <div>
          <span className="league-option-name">LaLiga Hypermotion</span>
          <span className="league-option-sub">Segunda División</span>
        </div>
      </button>
      <button
        className={`league-option${current === 'juvenil' ? ' active' : ''}`}
        onClick={() => { onChange('juvenil'); onClose(); }}
      >
        <img src={`${import.meta.env.BASE_URL}rffm-logo.png`} alt="RFFM" className="league-option-logo league-option-logo--rffm" />
        <div>
          <span className="league-option-name">Pref. Juvenil Gr.2</span>
          <span className="league-option-sub">Temporada 26/27</span>
        </div>
      </button>
    </div>
  );
}

export default function Header({ onLogin, league, onLeagueChange }) {
  const { profile, isGuest, logout } = useAuth();
  const { canInstall, install, isIos, isStandalone } = useInstallPrompt();
  const { theme, toggle: toggleTheme } = useTheme();
  const [installBannerOpen, setInstallBannerOpen] = useState(false);
  const [profileOpen, setProfileOpen]             = useState(false);
  const [instructionsOpen, setInstructionsOpen]   = useState(false);
  const [leagueOpen, setLeagueOpen]               = useState(false);

  const isSegunda = league === 'segunda';
  const isJuvenil = league === 'juvenil';

  return (
    <>
      <header className={`app-header${isSegunda ? ' app-header--segunda' : isJuvenil ? ' app-header--juvenil' : ''}`}>
        <div
          className="logo logo--clickable"
          onClick={() => setLeagueOpen(v => !v)}
          title="Cambiar liga"
        >
          {isSegunda ? (
            <img
              src={`${import.meta.env.BASE_URL}hypermotion-logo.png`}
              alt="LaLiga Hypermotion"
              className="logo-laliga logo-laliga--hm"
            />
          ) : isJuvenil ? (
            <img src={`${import.meta.env.BASE_URL}rffm-logo.png`} alt="RFFM" className="logo-laliga logo-laliga--rffm" />
          ) : (
            <img
              src={`${import.meta.env.BASE_URL}laliga-logo.png`}
              alt="LaLiga"
              className="logo-laliga"
            />
          )}
          <span>{isSegunda ? 'Hypermotion' : isJuvenil ? 'Pref. Juvenil' : 'Quiniela 26/27'}</span>
          <span className="logo-chevron">▾</span>
          <span className="app-version">v{version}</span>
        </div>

        {leagueOpen && (
          <LeagueDropdown
            current={league}
            onChange={onLeagueChange}
            onClose={() => setLeagueOpen(false)}
          />
        )}

        {!isStandalone && (
          <button className="btn-install" onClick={() => {
            if (canInstall) install();
            else setInstallBannerOpen(v => !v);
          }}>⬇ Instalar</button>
        )}

        {isGuest ? (
          <>
            <button className="btn-theme" onClick={toggleTheme} aria-label="Cambiar tema">{theme === 'dark' ? '☀' : '🌙'}</button>
            <button className="btn-help" onClick={() => setInstructionsOpen(true)}>?</button>
            <button className="btn-login" onClick={onLogin}>Iniciar sesión</button>
          </>
        ) : (
          <>
            <button className="btn-theme" onClick={toggleTheme} aria-label="Cambiar tema">{theme === 'dark' ? '☀' : '🌙'}</button>
            <button className="btn-help" onClick={() => setInstructionsOpen(true)}>?</button>
            <button className="avatar-btn" onClick={() => setProfileOpen(true)} title={profile?.username}>
              {profile?.avatar
                ? <img className="avatar-user-img" src={`${import.meta.env.BASE_URL}avatars/${profile.avatar}`} alt="avatar" />
                : profile?.favoriteTeam
                  ? <img className="avatar-crest" src={crestUrl(profile.favoriteTeam)} alt={profile.favoriteTeam} />
                  : initials(profile?.username || '')
              }
            </button>
            <button className="btn-logout" onClick={logout}>Salir</button>
          </>
        )}
      </header>

      {installBannerOpen  && <InstallBanner isIos={isIos} onDismiss={() => setInstallBannerOpen(false)} />}
      {profileOpen        && <ProfileModal onClose={() => setProfileOpen(false)} />}
      {instructionsOpen   && <InstructionsModal onClose={() => setInstructionsOpen(false)} />}
    </>
  );
}
