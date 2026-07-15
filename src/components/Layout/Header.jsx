import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';
import { crestUrl } from '../../lib/crests';
import ProfileModal from '../Profile/ProfileModal';
import { version } from '../../../package.json';

function initials(name) {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function IosInstallBanner({ onDismiss }) {
  return (
    <div className="ios-install-banner">
      <div className="ios-install-steps">
        <span>Para instalar la app:</span>
        <span>1· Pulsa el botón <strong>Compartir</strong> <span className="ios-share-icon">⎙</span> (barra inferior)</span>
        <span>2· Selecciona <strong>"Añadir a pantalla de inicio"</strong></span>
      </div>
      <button className="ios-install-dismiss" onClick={onDismiss} aria-label="Cerrar">✕</button>
    </div>
  );
}

export default function Header({ onLogin }) {
  const { profile, isGuest, logout } = useAuth();
  const { canInstall, install, isIos, isStandalone } = useInstallPrompt();
  const [iosBannerOpen, setIosBannerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

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

        {/* Android / Chrome: botón nativo */}
        {!isStandalone && canInstall && (
          <button className="btn-install" onClick={install}>⬇ Instalar</button>
        )}

        {/* iOS Safari: botón que abre instrucciones */}
        {!isStandalone && isIos && (
          <button className="btn-install" onClick={() => setIosBannerOpen(v => !v)}>⬇ Instalar</button>
        )}

        {isGuest ? (
          <button className="btn-login" onClick={onLogin}>Iniciar sesión</button>
        ) : (
          <>
            <button className="avatar-btn" onClick={() => setProfileOpen(true)} title={profile?.username}>
              {profile?.favoriteTeam
                ? <img className="avatar-crest" src={crestUrl(profile.favoriteTeam)} alt={profile.favoriteTeam} />
                : initials(profile?.username || '')
              }
            </button>
            <button className="btn-logout" onClick={logout}>Salir</button>
          </>
        )}
      </header>

      {iosBannerOpen && <IosInstallBanner onDismiss={() => setIosBannerOpen(false)} />}
      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
    </>
  );
}
