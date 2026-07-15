import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Header  from './components/Layout/Header';
import TabBar  from './components/Layout/TabBar';
import LoginPage    from './components/Auth/LoginPage';
import LoadingSpinner from './components/LoadingSpinner';
import CalendarTab   from './components/Calendar/CalendarTab';
import StandingsTab  from './components/Standings/StandingsTab';
import PredictTab    from './components/Predict/PredictTab';
import RankingTab    from './components/Ranking/RankingTab';
import HistoryTab    from './components/History/HistoryTab';

function AppShell() {
  const { isLoading, isGuest } = useAuth();
  const [tab, setTab]     = useState('calendar');
  const [showAuth, setShowAuth] = useState(false);

  if (isLoading) return <LoadingSpinner />;

  if (showAuth && isGuest) {
    return <LoginPage onClose={() => setShowAuth(false)} />;
  }

  function handleTabChange(newTab) {
    const requiresAuth = ['predict', 'ranking', 'history'].includes(newTab);
    if (requiresAuth && isGuest) {
      setShowAuth(true);
      return;
    }
    setTab(newTab);
  }

  return (
    <div className="app-shell">
      <Header onLogin={() => setShowAuth(true)} />
      <TabBar activeTab={tab} onTabChange={handleTabChange} />
      <main className="main-content">
        {tab === 'calendar'  && <CalendarTab  />}
        {tab === 'standings' && <StandingsTab />}
        {tab === 'predict'   && <PredictTab   />}
        {tab === 'ranking'   && <RankingTab   />}
        {tab === 'history'   && <HistoryTab   />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
