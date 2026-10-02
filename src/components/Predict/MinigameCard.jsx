import { useState } from 'react';
import MemoryPairsGame from './MemoryPairsGame';
import SwapPuzzleGame from './SwapPuzzleGame';
import SequenceRecallGame from './SequenceRecallGame';

export default function MinigameCard({ game, result, uid, onResultUpdate }) {
  const [playing, setPlaying] = useState(false);
  const [replay, setReplay]   = useState(false);

  const now     = Date.now();
  const start   = game.startDate?.toMillis?.() ?? 0;
  const end     = game.endDate?.toMillis?.() ?? 0;
  const isActive = now >= start && now <= end;

  const endDate  = game.endDate?.toDate?.();
  const endLabel = endDate
    ? endDate.toLocaleString('es-ES', {
        weekday: 'short', day: 'numeric', month: 'short',
        hour: '2-digit', minute: '2-digit',
        timeZone: 'Europe/Madrid',
      })
    : '';

  const started   = result?.started   ?? false;
  const completed = result?.completed ?? false;
  const pts       = result?.points    ?? 0;

  async function handleFinish() {
    setPlaying(false);
    setReplay(false);
    await onResultUpdate?.();
  }

  if (playing) {
    if (game.type === 'puzzle') {
      return <SwapPuzzleGame game={game} uid={uid} onFinish={handleFinish} replay={replay} />;
    }
    if (game.type === 'sequence') {
      return <SequenceRecallGame game={game} uid={uid} onFinish={handleFinish} replay={replay} />;
    }
    return <MemoryPairsGame game={game} uid={uid} onFinish={handleFinish} replay={replay} />;
  }

  return (
    <div className="minigame-card">
      <div className="minigame-card-inner">
        <div className="minigame-card-left">
          <span className="minigame-icon">🎮</span>
          <div>
            <div className="minigame-title">{game.title || 'Juego de Parejas'}</div>
            {isActive && !started && (
              <div className="minigame-meta">Hasta {endLabel}</div>
            )}
            {started && completed && (
              <div className="minigame-meta" style={{ color: 'var(--green)' }}>✅ Completado</div>
            )}
            {started && !completed && (
              <div className="minigame-meta" style={{ color: '#f59e0b' }}>⏰ Tiempo agotado</div>
            )}
            {!started && !isActive && (
              <div className="minigame-meta">Plazo cerrado</div>
            )}
          </div>
        </div>

        <div className="minigame-card-right">
          {started && (
            <span className={`minigame-pts-badge ${completed ? 'badge-green' : 'badge-orange'}`}>
              +{pts} pts
            </span>
          )}
          {isActive && !started && (
            <button className="minigame-play-btn" onClick={() => setPlaying(true)}>
              Jugar →
            </button>
          )}
          {!isActive && !started && (
            <button className="minigame-play-btn" style={{ opacity: 0.65 }} onClick={() => { setReplay(true); setPlaying(true); }}>
              Jugar →
            </button>
          )}
          {started && (
            <button className="minigame-play-btn" style={{ opacity: 0.65 }} onClick={() => { setReplay(true); setPlaying(true); }}>
              Repetir →
            </button>
          )}
        </div>
      </div>

      {!started && (
        <p className="minigame-desc">
          {game.type === 'puzzle'
            ? <>Reconstruye el logo en {game.timeLimit ?? 90}s intercambiando piezas.</>
            : game.type === 'sequence'
              ? <>Repite la secuencia de escudos al estilo Simon. 4 niveles, {game.timeLimit ?? 60}s.</>
              : <>Encuentra las {game.pairsCount ?? 10} parejas de escudos en {game.timeLimit ?? 60}s.</>
          }
          {isActive
            ? <>{' '}Completarlo suma <strong>{game.pointsComplete ?? 10} pts</strong>; empezar ya garantiza <strong>{game.pointsStarted ?? 5} pts</strong>.</>
            : <>{' '}El plazo ha terminado — puedes jugarlo pero <strong>no suma puntos</strong>.</>
          }
        </p>
      )}
    </div>
  );
}
