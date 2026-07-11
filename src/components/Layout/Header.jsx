import { useAuth } from '../../contexts/AuthContext';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';

function initials(name) {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

export default function Header({ onLogin }) {
  const { profile, isGuest, logout } = useAuth();
  const { canInstall, install } = useInstallPrompt();

  return (
    <header className="app-header">
      <div className="logo">
        <img
          src={`${import.meta.env.BASE_URL}laliga-logo.png`}
          alt="LaLiga"
          className="logo-laliga"
        />
        <span>Quiniela 26/27</span>
      </div>
      {canInstall && (
        <button className="btn-install" onClick={install} title="Instalar app">⬇ Instalar</button>
      )}
      {isGuest ? (
        <button className="btn-login" onClick={onLogin}>Iniciar sesión</button>
      ) : (
        <>
          <div className="avatar" title={profile?.username}>
            {initials(profile?.username || '')}
          </div>
          <button className="btn-logout" onClick={logout}>Salir</button>
        </>
      )}
    </header>
  );
}
