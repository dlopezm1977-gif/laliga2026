import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export default function RegisterPage({ onClose, onBack }) {
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    setLoading(true);
    try {
      await register(email, password, username.trim());
      onClose();
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setError('Ese email ya está registrado.');
      } else {
        setError('Error al crear la cuenta. Inténtalo de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Crear cuenta</h1>
        <p className="subtitle">Quiniela LaLiga 26/27</p>
        <img src={`${import.meta.env.BASE_URL}icon-register.png`} alt="" className="auth-register-banner" />
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nombre</label>
            <input
              type="text" required autoFocus maxLength={30}
              placeholder="Tu nombre visible en el ranking"
              value={username} onChange={e => setUsername(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email" required
              value={email} onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Contraseña</label>
            <input
              type="password" required minLength={6}
              value={password} onChange={e => setPassword(e.target.value)}
            />
          </div>
          {error && <div className="auth-error">{error}</div>}
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Creando cuenta…' : 'Crear cuenta'}
          </button>
        </form>
        <div className="auth-switch">
          ¿Ya tienes cuenta?{' '}
          <button onClick={onBack}>Inicia sesión</button>
        </div>
      </div>
    </div>
  );
}
