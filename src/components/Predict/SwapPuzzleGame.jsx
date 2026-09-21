import { useState, useEffect, useRef } from 'react';
import { saveMinigameStarted, saveMinigameCompleted } from '../../lib/firestore';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  if (a.every((v, i) => v === i)) return shuffle(arr);
  return a;
}

export default function SwapPuzzleGame({ game, uid, onFinish }) {
  const N         = game.gridSize ?? 4;
  const total     = N * N;
  const timeLimit = game.timeLimit ?? 90;

  const [tiles, setTiles]     = useState(() => shuffle([...Array(total).keys()]));
  const [selected, setSelected] = useState(null); // position index
  const [phase, setPhase]     = useState('playing');
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [moves, setMoves]     = useState(0);
  const startTimeRef  = useRef(Date.now());
  const savedStartRef = useRef(false);
  const savedEndRef   = useRef(false);

  const imageUrl = game.imageUrl ?? `${import.meta.env.BASE_URL}app-icon.png`;

  useEffect(() => {
    if (!savedStartRef.current && uid) {
      savedStartRef.current = true;
      saveMinigameStarted(uid, game.id).catch(() => {});
    }
  }, []);

  // Countdown
  useEffect(() => {
    if (phase !== 'playing') return;
    if (timeLeft <= 0) { setPhase('timeout'); return; }
    const t = setTimeout(() => setTimeLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, phase]);

  // Win check
  useEffect(() => {
    if (phase !== 'playing') return;
    if (tiles.every((t, i) => t === i)) {
      const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
      setPhase('won');
      if (!savedEndRef.current && uid) {
        savedEndRef.current = true;
        saveMinigameCompleted(uid, game.id, elapsed).catch(() => {});
      }
    }
  }, [tiles, phase]);

  function handleTileClick(pos) {
    if (phase !== 'playing') return;
    if (selected === null) {
      setSelected(pos);
    } else if (selected === pos) {
      setSelected(null);
    } else {
      setTiles(prev => {
        const next = [...prev];
        [next[selected], next[pos]] = [next[pos], next[selected]];
        return next;
      });
      setSelected(null);
      setMoves(m => m + 1);
    }
  }

  function tileStyle(originalIdx) {
    const row = Math.floor(originalIdx / N);
    const col = originalIdx % N;
    const bpx = N > 1 ? (col * 100) / (N - 1) : 0;
    const bpy = N > 1 ? (row * 100) / (N - 1) : 0;
    return {
      backgroundImage: `url(${imageUrl})`,
      backgroundSize: `${N * 100}% ${N * 100}%`,
      backgroundPosition: `${bpx}% ${bpy}%`,
    };
  }

  const pct = Math.round((timeLeft / timeLimit) * 100);
  const timerColor = timeLeft <= 10 ? '#ef4444' : timeLeft <= 20 ? '#f59e0b' : 'var(--green)';

  return (
    <div className="memory-game">
      <div className="memory-header">
        <span className="memory-pairs-count">
          {moves} <span style={{ color: 'var(--muted)', fontSize: '.75rem' }}>movs</span>
        </span>
        <div className="memory-timer-wrap">
          <div className="memory-timer-bar" style={{ '--pct': `${pct}%`, '--color': timerColor }} />
          <span className="memory-timer-label" style={{ color: timerColor }}>⏱ {timeLeft}s</span>
        </div>
      </div>

      {phase === 'won' && (
        <div className="memory-result memory-result--won">
          <img
            src={imageUrl}
            alt="Puzzle completado"
            className="puzzle-reveal-img"
          />
          <div className="memory-result-title">¡Puzzle completado!</div>
          <div className="memory-result-pts">+{game.pointsComplete ?? 10} pts</div>
          <button className="btn-save" style={{ marginTop: '1rem' }} onClick={onFinish}>Continuar</button>
        </div>
      )}
      {phase === 'timeout' && (
        <div className="memory-result memory-result--timeout">
          <div className="memory-result-icon">⏰</div>
          <div className="memory-result-title">¡Tiempo agotado!</div>
          <div className="memory-result-pts" style={{ color: '#f59e0b' }}>+{game.pointsStarted ?? 5} pts por participar</div>
          <button className="btn-save" style={{ marginTop: '1rem' }} onClick={onFinish}>Continuar</button>
        </div>
      )}

      {phase === 'playing' && (
        <div
          className="puzzle-grid"
          style={{ gridTemplateColumns: `repeat(${N}, 1fr)` }}
        >
          {tiles.map((originalIdx, pos) => {
            const isCorrect = originalIdx === pos;
            const isSelected = selected === pos;
            return (
              <button
                key={pos}
                className={`puzzle-tile${isSelected ? ' puzzle-tile--selected' : ''}${isCorrect ? ' puzzle-tile--correct' : ''}`}
                style={tileStyle(originalIdx)}
                onClick={() => handleTileClick(pos)}
                aria-label={`Pieza ${originalIdx + 1}`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
