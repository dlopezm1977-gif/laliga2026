import { useState } from 'react';
import MemoryPairsGame from './MemoryPairsGame';

export default function MinigameCard({ game, result, uid, onResultUpdate }) {
  const [playing, setPlaying] = useState(false);

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
    await onResultUpdate?.();
  }

  if (playing) {
    return <MemoryPairsGame game={game} uid={uid} onFinish={handleFinish} />;
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
          {!started && !isActive && (
            <span className="minigame-pts-badge badge-red">0 pts</span>
          )}
          {isActive && !started && (
            <button className="minigame-play-btn" onClick={() => setPlaying(true)}>
              Jugar →
            </button>
          )}
        </div>
      </div>

      {isActive && !started && (
        <p className="minigame-desc">
          Encuentra las {game.pairsCount ?? 10} parejas de escudos en {game.timeLimit ?? 60}s.
          Completarlo suma <strong>{game.pointsComplete ?? 10} pts</strong>;
          empezar ya garantiza <strong>{game.pointsStarted ?? 5} pts</strong>.
        </p>
      )}
    </div>
  );
}
