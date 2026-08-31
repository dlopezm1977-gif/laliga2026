import { useState, useEffect } from 'react';
import { useMatches } from '../../hooks/useMatches';
import { crestUrl, teamAbbr } from '../../lib/crests';
import { useAuth } from '../../contexts/AuthContext';
import { getPrediction, savePrediction } from '../../lib/firestore';
import LoadingSpinner from '../LoadingSpinner';
import SeasonPredictTab from '../Season/SeasonPredictTab';
import MonthlyPredictTab from './MonthlyPredictTab';
import { useMinigames } from '../../hooks/useMinigames';
import MinigameCard from './MinigameCard';

function getSign(h, a) {
  if (h > a) return 'H';
  if (a > h) return 'A';
  return 'D';
}

const ABBR = {
  'Real Madrid':   'RMA', 'Barcelona':     'BAR', 'Atlético':      'ATL',
  'Sevilla':       'SEV', 'Betis':         'BET', 'Real Sociedad': 'RSO',
  'Villarreal':    'VIL', 'Athletic':      'ATH', 'Valencia':      'VAL',
  'Osasuna':       'OSA', 'Celta':         'CEL', 'Getafe':        'GET',
  'Rayo':          'RAY', 'Alavés':        'ALA', 'Espanyol':      'ESP',
  'Racing':        'RAC', 'Levante':       'LEV', 'Deportivo':     'DEP',
  'Elche':         'ELC', 'Málaga':        'MÁL',
};

function ScoreInput({ value, onChange, disabled }) {
  const n = value ?? 0;
  return (
    <div className="score-input">
      <button type="button" className="score-btn" onClick={() => onChange(Math.max(0, n - 1))} disabled={disabled}>−</button>
      <div className="score-val">
        <input
          type="number" min={0} max={9}
          value={n}
          onChange={e => onChange(Math.max(0, Math.min(9, +e.target.value || 0)))}
          readOnly={disabled}
        />
      </div>
      <button type="button" className="score-btn" onClick={() => onChange(Math.min(9, n + 1))} disabled={disabled}>+</button>
    </div>
  );
}

function PredictCard({ match, pred, onUpdate, closed, favoriteTeam, onSetFavorite }) {
  const home = pred?.homeScore ?? 0;
  const away = pred?.awayScore ?? 0;
  const homeIsFav = favoriteTeam === match.homeTeam;
  const awayIsFav = favoriteTeam === match.awayTeam;
  const hasFav = homeIsFav || awayIsFav;

  const hasResult  = match.homeScore !== null && match.awayScore !== null;
  const isLive     = ['IN_PLAY', 'PAUSED', 'LIVE'].includes(match.status);
  const isFinished = match.status === 'FINISHED';

  let badge = null;
  if (hasResult && (isFinished || isLive)) {
    const rh = match.homeScore, ra = match.awayScore;
    if (home === rh && away === ra) {
      badge = hasFav ? { label: '⭐ Exacto', cls: 'exact fav', pts: 6 } : { label: 'Exacto', cls: 'exact', pts: 3 };
    } else if (getSign(home, away) === getSign(rh, ra)) {
      badge = hasFav ? { label: '⭐ Signo', cls: 'sign fav', pts: 2 } : { label: 'Signo', cls: 'sign', pts: 1 };
    } else {
      badge = { label: 'Fallo', cls: 'miss', pts: 0 };
    }
  }

  return (
    <div className={`predict-card${closed ? ' closed' : ''}${hasFav ? ' has-favorite' : ''}${isFinished ? ' predict-card--finished' : ''}`}>
      <div className="match-team home">
        <button
          type="button"
          className={`fav-star${homeIsFav ? ' active' : ''}`}
          onClick={() => onSetFavorite(homeIsFav ? null : match.homeTeam)}
          disabled={closed}
          title={homeIsFav ? 'Quitar favorito' : `${match.homeTeam} como favorito`}
        >{homeIsFav ? '⭐' : '☆'}</button>
        <img className="team-crest" src={crestUrl(match.homeTeam)} alt={match.homeTeam} />
        <span className="team-name team-full">{match.homeTeam}</span>
        <span className="team-name team-abbr">{teamAbbr(match.homeTeam)}</span>
      </div>
      <div className="predict-center">
        <ScoreInput value={home} onChange={v => onUpdate(match.matchId, 'homeScore', v)} disabled={closed} />
        <span className="predict-sep">:</span>
        <ScoreInput value={away} onChange={v => onUpdate(match.matchId, 'awayScore', v)} disabled={closed} />
      </div>
      <div className="match-team away">
        <span className="team-name team-full">{match.awayTeam}</span>
        <span className="team-name team-abbr">{teamAbbr(match.awayTeam)}</span>
        <img className="team-crest" src={crestUrl(match.awayTeam)} alt={match.awayTeam} />
        <button
          type="button"
          className={`fav-star${awayIsFav ? ' active' : ''}`}
          onClick={() => onSetFavorite(awayIsFav ? null : match.awayTeam)}
          disabled={closed}
          title={awayIsFav ? 'Quitar favorito' : `${match.awayTeam} como favorito`}
        >{awayIsFav ? '⭐' : '☆'}</button>
      </div>

      {(hasResult || isLive) && (
        <div className="predict-match-result">
          {isLive  && <span className="predict-status-live">🔴 En curso</span>}
          {isFinished && <span className="predict-status-done">✅ Finalizado</span>}
          {hasResult && (
            <span className="predict-real-score">{match.homeScore} : {match.awayScore}</span>
          )}
          {badge && (
            <span className={`result-badge ${badge.cls}`}>
              {badge.label}{badge.pts > 0 ? ` +${badge.pts}` : ''}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function deadlineLabel(matches) {
  if (!matches.length) return null;
  const dates = matches.map(m => new Date(m.utcDate)).filter(Boolean);
  dates.sort((a, b) => a - b);
  const first = dates[0];
  return first.toLocaleString('es-ES', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Madrid',
  });
}

export default function PredictTab() {
  const { user, profile } = useAuth();
  const { currentMatchday, getMatches, loading: matchesLoading } = useMatches();
  const [view, setView]                 = useState('jornadas');
  const [jornada, setJornada]           = useState(null);
  const [preds, setPreds]               = useState({});
  const [favoriteTeam, setFavoriteTeam] = useState(null);
  const [saving, setSaving]             = useState(false);
  const [saved, setSaved]               = useState(false);
  const [hasChanges, setHasChanges]     = useState(false);
  const [savedOnce, setSavedOnce]       = useState(false);
  const [loadingPreds, setLoadingPreds] = useState(false);

  const { visibleMinigames, userResults: minigameResults, refresh: refreshMinigames } = useMinigames(user?.uid);
  const [showingMinigame, setShowingMinigame] = useState(null);

  function goNext() {
    if (showingMinigame) {
      setShowingMinigame(null);
      setJornada(showingMinigame.afterMatchday + 1);
      setSaved(false);
    } else if (minigameAfter) {
      setShowingMinigame(minigameAfter);
    } else {
      setJornada(Math.min(38, activeJornada + 1));
      setSaved(false);
    }
  }

  function goPrev() {
    if (showingMinigame) {
      setShowingMinigame(null);
      setJornada(showingMinigame.afterMatchday);
      setSaved(false);
    } else if (minigameBefore) {
      setShowingMinigame(minigameBefore);
    } else {
      setJornada(Math.max(1, activeJornada - 1));
      setSaved(false);
    }
  }

  const activeJornada = jornada ?? currentMatchday;
  const matches = getMatches(activeJornada);

  const minigameAfter  = visibleMinigames.find(g => g.afterMatchday === activeJornada) ?? null;
  const minigameBefore = visibleMinigames.find(g => g.afterMatchday === activeJornada - 1) ?? null;

  const firstMatchTime = matches.length
    ? Math.min(...matches.map(m => new Date(m.utcDate).getTime()).filter(Boolean))
    : Infinity;
  const isClosed = Date.now() >= firstMatchTime;

  useEffect(() => {
    if (!user || !activeJornada) return;
    setHasChanges(false);
    setSaved(false);
    setSavedOnce(false);
    setLoadingPreds(true);
    getPrediction(user.uid, activeJornada)
      .then(data => {
        if (data?.matches) {
          const map = {};
          data.matches.forEach(m => { map[m.matchId] = m; });
          setPreds(map);
          setSavedOnce(true);
        } else {
          setPreds({});
        }
        setFavoriteTeam(data?.favoriteTeam ?? profile?.favoriteTeam ?? null);
      })
      .finally(() => setLoadingPreds(false));
  }, [user, activeJornada]);

  function handleUpdate(matchId, field, value) {
    setPreds(prev => ({
      ...prev,
      [matchId]: { ...(prev[matchId] || { matchId }), [field]: value },
    }));
    setHasChanges(true);
    setSaved(false);
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    try {
      const matchList = matches.map(m => ({
        matchId:   m.matchId,
        homeScore: preds[m.matchId]?.homeScore ?? 0,
        awayScore: preds[m.matchId]?.awayScore ?? 0,
      }));
      await savePrediction(user.uid, activeJornada, matchList, favoriteTeam);
      setHasChanges(false);
      setSavedOnce(true);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  function handleSetFavorite(team) {
    setFavoriteTeam(team);
    setHasChanges(true);
    setSaved(false);
  }

  if (matchesLoading || loadingPreds) return <LoadingSpinner />;

  const deadline = deadlineLabel(matches);

  return (
    <>
      <div className="standings-toggle" style={{ marginBottom: '1rem' }}>
        <button
          className={`toggle-btn${view === 'jornadas' ? ' active' : ''}`}
          onClick={() => setView('jornadas')}
        >Jornadas</button>
        <button
          className={`toggle-btn${view === 'mensual' ? ' active' : ''}`}
          onClick={() => setView('mensual')}
        >Mensual</button>
        <button
          className={`toggle-btn${view === 'general' ? ' active' : ''}`}
          onClick={() => setView('general')}
        >General</button>
      </div>

      {view === 'general' ? (
        <SeasonPredictTab />
      ) : view === 'mensual' ? (
        <MonthlyPredictTab />
      ) : (
        <>
          <div className="jornada-nav">
            <button className="btn-nav" onClick={goPrev} disabled={!showingMinigame && activeJornada <= 1 && !minigameBefore}>‹</button>
            <div>
              {showingMinigame
                ? (() => {
                    const endDate = showingMinigame.endDate?.toDate?.();
                    const endLabel = endDate ? endDate.toLocaleString('es-ES', {
                      weekday: 'short', day: 'numeric', month: 'short',
                      hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid',
                    }) : '';
                    const isPast = endDate && Date.now() > endDate.getTime();
                    return <>
                      <h2 style={{ fontSize: '1rem' }}>🎮 {showingMinigame.title || 'Juego de Parejas'}</h2>
                      <span className="dates">
                        {isPast
                          ? <span className="deadline-badge">Cerrado</span>
                          : <>Hasta: {endLabel}</>
                        }
                      </span>
                    </>;
                  })()
                : <><h2>Jornada {activeJornada}</h2>
                    {deadline && (
                      <span className="dates">
                        {isClosed
                          ? <span className="deadline-badge">Cerrada</span>
                          : <>Cierre: {deadline} · ⭐ ×2</>
                        }
                      </span>
                    )}</>
              }
            </div>
            <button className="btn-nav" onClick={goNext} disabled={!showingMinigame && activeJornada >= 38 && !minigameAfter}>›</button>
          </div>

          {showingMinigame ? (
            <MinigameCard
              game={showingMinigame}
              result={minigameResults[showingMinigame.id]}
              uid={user?.uid}
              onResultUpdate={refreshMinigames}
            />
          ) : matches.length === 0 ? (
            <div className="loading">No hay datos para esta jornada</div>
          ) : (
            <>
              {matches
                .slice()
                .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate))
                .map(m => (
                  <PredictCard
                    key={m.matchId}
                    match={m}
                    pred={preds[m.matchId]}
                    onUpdate={handleUpdate}
                    closed={isClosed}
                    favoriteTeam={favoriteTeam}
                    onSetFavorite={handleSetFavorite}
                  />
                ))
              }

              {!isClosed && (
                <button className="btn-save" onClick={handleSave} disabled={saving || !hasChanges}>
                  {saving ? 'Guardando…' : (!hasChanges && savedOnce) ? '✓ Guardado' : 'Guardar predicciones'}
                </button>
              )}
              {saved && (
                <div className="save-overlay" onClick={() => setSaved(false)}>
                  <img src={`${import.meta.env.BASE_URL}icon-success.png`} alt="" className="save-overlay-icon" />
                  <p className="save-overlay-hint">Toca para continuar</p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
