import { useAuth } from '../../contexts/AuthContext';

function initials(name) {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

export default function Header() {
  const { profile, isGuest, logout } = useAuth();

  return (
    <header className="app-header">
      <div className="logo">
        LALIGA <span>Quiniela 26/27</span>
      </div>
      {isGuest ? (
        <span style={{ fontSize: '.75rem', color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
          Invitado
        </span>
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
