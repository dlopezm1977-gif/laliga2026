import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Header  from './components/Layout/Header';
import TabBar  from './components/Layout/TabBar';
import LoginPage    from './components/Auth/LoginPage';
import LoadingSpinner from './components/LoadingSpinner';
import CalendarTab  from './components/Calendar/CalendarTab';
import StandingsTab from './components/Standings/StandingsTab';
import PredictTab   from './components/Predict/PredictTab';
import RankingTab   from './components/Ranking/RankingTab';
import HistoryTab   from './components/History/HistoryTab';
import CalendarSegundaTab  from './components/Segunda/CalendarSegundaTab';
import StandingsSegundaTab from './components/Segunda/StandingsSegundaTab';

const DEFAULT_TAB_PRIMERA = 'calendar';
const DEFAULT_TAB_SEGUNDA = 'resultados';

function AppShell() {
  const { isLoading, isGuest } = useAuth();
  const [league, setLeague] = useState('primera');
  const [tab, setTab]       = useState(DEFAULT_TAB_PRIMERA);
  const [showAuth, setShowAuth] = useState(false);

  if (isLoading) return <LoadingSpinner />;

  if (showAuth && isGuest) {
    return <LoginPage onClose={() => setShowAuth(false)} />;
  }

  function handleLeagueChange(newLeague) {
    setLeague(newLeague);
    setTab(newLeague === 'segunda' ? DEFAULT_TAB_SEGUNDA : DEFAULT_TAB_PRIMERA);
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
    <div className={`app-shell${league === 'segunda' ? ' app-shell--segunda' : ''}`}>
      <Header
        onLogin={() => setShowAuth(true)}
        league={league}
        onLeagueChange={handleLeagueChange}
      />
      <TabBar activeTab={tab} onTabChange={handleTabChange} league={league} />
      <main className="main-content">
        {league === 'primera' && tab === 'calendar'       && <CalendarTab />}
        {league === 'primera' && tab === 'standings'      && <StandingsTab />}
        {league === 'primera' && tab === 'predict'        && <PredictTab />}
        {league === 'primera' && tab === 'ranking'        && <RankingTab />}
        {league === 'primera' && tab === 'history'        && <HistoryTab />}
        {league === 'segunda' && tab === 'resultados'     && <CalendarSegundaTab />}
        {league === 'segunda' && tab === 'clasificacion'  && <StandingsSegundaTab />}
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
