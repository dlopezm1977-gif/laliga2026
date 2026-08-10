import { useState } from 'react';
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

export default function Header({ onLogin }) {
  const { profile, isGuest, logout } = useAuth();
  const { canInstall, install, isIos, isStandalone } = useInstallPrompt();
  const { theme, toggle: toggleTheme } = useTheme();
  const [installBannerOpen, setInstallBannerOpen] = useState(false);
  const [profileOpen, setProfileOpen]           = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);

  return (
    <>
      <header className="app-header">
        <div className="logo">
          <img
            src={`${import.meta.env.BASE_URL}laliga-logo.png`}
            alt="LaLiga"
            className="logo-laliga"
          />
          <span>Quiniela 26/27</span>
          <span className="app-version">v{version}</span>
        </div>

        {/* Botón instalar: siempre visible si no está en standalone */}
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
