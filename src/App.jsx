import { useState, useEffect } from 'react';
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
import CalendarRffmTab       from './components/Rffm/CalendarRffmTab';
import StandingsRffmTab      from './components/Rffm/StandingsRffmTab';
import CalendarMunicipalTab  from './components/Municipal/CalendarMunicipalTab';
import StandingsMunicipalTab from './components/Municipal/StandingsMunicipalTab';

const DEFAULT_TAB_PRIMERA   = 'calendar';
const DEFAULT_TAB_SEGUNDA   = 'resultados';
const DEFAULT_TAB_JUVENIL   = 'resultados';
const DEFAULT_TAB_MUNICIPAL = 'resultados';

function AppShell() {
  const { isLoading, isGuest } = useAuth();
  const [league, setLeague] = useState(() => {
    const p = new URLSearchParams(location.search);
    return ['primera', 'segunda', 'juvenil', 'municipal'].includes(p.get('league')) ? p.get('league') : 'primera';
  });
  const [tab, setTab] = useState(() => {
    const p = new URLSearchParams(location.search);
    return p.get('tab') || DEFAULT_TAB_PRIMERA;
  });
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    if (!navigator.serviceWorker) return;
    const handler = ({ data }) => {
      if (data?.type !== 'NAVIGATE') return;
      handleLeagueChange(data.league);
      if (data.tab) setTab(data.tab);
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, []);

  if (isLoading) return <LoadingSpinner />;

  if (showAuth && isGuest) {
    return <LoginPage onClose={() => setShowAuth(false)} />;
  }

  function handleLeagueChange(newLeague) {
    setLeague(newLeague);
    setTab(
      newLeague === 'segunda'   ? DEFAULT_TAB_SEGUNDA   :
      newLeague === 'juvenil'   ? DEFAULT_TAB_JUVENIL   :
      newLeague === 'municipal' ? DEFAULT_TAB_MUNICIPAL :
      DEFAULT_TAB_PRIMERA
    );
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
    <div className={`app-shell${league === 'segunda' ? ' app-shell--segunda' : league === 'juvenil' ? ' app-shell--juvenil' : league === 'municipal' ? ' app-shell--municipal' : ''}`}>
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
        {league === 'juvenil'   && tab === 'resultados'     && <CalendarRffmTab />}
        {league === 'juvenil'   && tab === 'clasificacion'  && <StandingsRffmTab />}
        {league === 'municipal' && tab === 'resultados'     && <CalendarMunicipalTab />}
        {league === 'municipal' && tab === 'clasificacion'  && <StandingsMunicipalTab />}
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
