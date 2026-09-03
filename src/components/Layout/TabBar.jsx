import { useAuth } from '../../contexts/AuthContext';

const PRIMERA_TABS = [
  { id: 'calendar',  label: 'Calendario',    icon: '📅', requiresAuth: false },
  { id: 'standings', label: 'Clasificación', icon: '📋', requiresAuth: false },
  { id: 'predict',   label: 'Predecir',      icon: '🎯', requiresAuth: true  },
  { id: 'ranking',   label: 'Ranking',       icon: '🏆', requiresAuth: true  },
  { id: 'history',   label: 'Historial',     icon: '📊', requiresAuth: true  },
];

const SEGUNDA_TABS = [
  { id: 'resultados',    label: 'Resultados',    icon: '📅', requiresAuth: false },
  { id: 'clasificacion', label: 'Clasificación', icon: '📋', requiresAuth: false },
];

const JUVENIL_TABS = [
  { id: 'resultados',    label: 'Resultados',    icon: '📅', requiresAuth: false },
  { id: 'clasificacion', label: 'Clasificación', icon: '📋', requiresAuth: false },
];

export default function TabBar({ activeTab, onTabChange, league }) {
  const { isGuest } = useAuth();
  const tabs = league === 'segunda' ? SEGUNDA_TABS : league === 'juvenil' ? JUVENIL_TABS : PRIMERA_TABS;

  return (
    <nav className={`tab-bar${league === 'segunda' ? ' tab-bar--segunda' : league === 'juvenil' ? ' tab-bar--juvenil' : ''}`}>
      {tabs.map(tab => {
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
