import { useAuth } from '../../contexts/AuthContext';

const TABS = [
  { id: 'calendar',  label: 'Calendario',    icon: '📅', requiresAuth: false },
  { id: 'standings', label: 'Clasificación', icon: '📋', requiresAuth: false },
  { id: 'predict',   label: 'Predecir',      icon: '🎯', requiresAuth: true  },
  { id: 'ranking',   label: 'Ranking',       icon: '🏆', requiresAuth: true  },
  { id: 'history',   label: 'Historial',     icon: '📊', requiresAuth: true  },
];

export default function TabBar({ activeTab, onTabChange }) {
  const { isGuest } = useAuth();

  return (
    <nav className="tab-bar">
      {TABS.map(tab => {
        const locked = tab.requiresAuth && isGuest;
        return (
          <button
            key={tab.id}
            className={`tab-btn${activeTab === tab.id ? ' active' : ''}${locked ? ' locked' : ''}`}
            onClick={() => !locked && onTabChange(tab.id)}
            aria-label={locked ? `${tab.label} (solo usuarios registrados)` : tab.label}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
            {locked && <span className="lock-icon">🔒</span>}
          </button>
        );
      })}
    </nav>
  );
}
