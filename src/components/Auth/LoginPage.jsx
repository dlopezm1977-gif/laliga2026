import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import RegisterPage from './RegisterPage';

export default function LoginPage({ onClose }) {
  const { login, resetPassword } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showReset, setShowReset]       = useState(false);
  const [resetSent, setResetSent]       = useState(false);
  const [resetEmail, setResetEmail]     = useState('');

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

  async function handleReset(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await resetPassword(resetEmail);
      setResetSent(true);
    } catch {
      setError('No se encontró ninguna cuenta con ese email.');
    } finally {
      setLoading(false);
    }
  }

  if (showReset) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Recuperar contraseña</h1>
          <p className="subtitle">Te enviaremos un enlace a tu email</p>
          {resetSent ? (
            <>
              <div className="auth-ok">
                Correo enviado. Revisa tu bandeja de entrada.
              </div>
              <button className="btn-primary" onClick={() => { setShowReset(false); setResetSent(false); }}>
                Volver al inicio de sesión
              </button>
            </>
          ) : (
            <form onSubmit={handleReset}>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email" required autoFocus
                  value={resetEmail} onChange={e => setResetEmail(e.target.value)}
                />
              </div>
              {error && <div className="auth-error">{error}</div>}
              <button className="btn-primary" type="submit" disabled={loading}>
                {loading ? 'Enviando…' : 'Enviar enlace'}
              </button>
            </form>
          )}
          <button className="guest-link" onClick={() => { setShowReset(false); setError(''); }}>
            ← Volver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div>
            <h1>Iniciar sesión</h1>
            <p className="subtitle">Quiniela LaLiga 26/27</p>
          </div>
          <img src={`${import.meta.env.BASE_URL}icon-login.png`} alt="" className="auth-page-icon" />
        </div>
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
            <button
              type="button"
              className="forgot-link"
              onClick={() => { setResetEmail(email); setShowReset(true); setError(''); }}
            >
              ¿Olvidaste tu contraseña?
            </button>
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
