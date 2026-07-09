import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import RegisterPage from './RegisterPage';

export default function LoginPage({ onClose }) {
  const { login } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  if (showRegister) {
    return <RegisterPage onClose={onClose} onBack={() => setShowRegister(false)} />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      onClose();
    } catch {
      setError('Email o contraseña incorrectos.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Iniciar sesión</h1>
        <p className="subtitle">Quiniela LaLiga 26/27</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email" required autoFocus
              value={email} onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Contraseña</label>
            <input
              type="password" required
              value={password} onChange={e => setPassword(e.target.value)}
            />
          </div>
          {error && <div className="auth-error">{error}</div>}
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
        <div className="auth-switch">
          ¿No tienes cuenta?{' '}
          <button onClick={() => setShowRegister(true)}>Regístrate</button>
        </div>
        <button className="guest-link" onClick={onClose}>
          Continuar como invitado (solo calendario)
        </button>
      </div>
    </div>
  );
}
