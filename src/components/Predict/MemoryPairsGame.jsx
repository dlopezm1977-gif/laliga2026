import { useState, useEffect, useRef } from 'react';
import { crestUrl } from '../../lib/crests';
import { saveMinigameStarted, saveMinigameCompleted } from '../../lib/firestore';

const ALL_TEAMS = [
  'Real Madrid', 'Barcelona', 'Atlético', 'Sevilla', 'Betis',
  'Real Sociedad', 'Villarreal', 'Athletic', 'Valencia', 'Osasuna',
  'Celta', 'Getafe', 'Rayo', 'Alavés', 'Espanyol',
  'Racing', 'Levante', 'Deportivo', 'Elche', 'Málaga',
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildCards(pairsCount) {
  const teams = shuffle(ALL_TEAMS).slice(0, pairsCount);
  const cards = teams.flatMap((team, i) => [
    { id: i * 2,     team, flipped: false, matched: false },
    { id: i * 2 + 1, team, flipped: false, matched: false },
  ]);
  return shuffle(cards);
}

export default function MemoryPairsGame({ game, uid, onFinish }) {
  const pairsCount = game.pairsCount ?? 10;
  const timeLimit  = game.timeLimit ?? 60;

  const [cards, setCards]     = useState(() => buildCards(pairsCount));
  const [selected, setSelected] = useState([]);   // up to 2 card indices currently flipped
  const [locked, setLocked]   = useState(false);
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [phase, setPhase]     = useState('playing'); // 'playing' | 'won' | 'timeout'
  const startTimeRef = useRef(Date.now());
  const savedStartRef = useRef(false);
  const savedEndRef   = useRef(false);

  // Save "started" once on mount → 5 pts guaranteed
  useEffect(() => {
    if (!savedStartRef.current && uid) {
      savedStartRef.current = true;
      saveMinigameStarted(uid, game.id).catch(() => {});
    }
  }, []);

  // Countdown timer
  useEffect(() => {
    if (phase !== 'playing') return;
    if (timeLeft <= 0) { setPhase('timeout'); return; }
    const t = setTimeout(() => setTimeLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, phase]);

  // Check win condition
  useEffect(() => {
    if (phase !== 'playing') return;
    if (cards.length > 0 && cards.every(c => c.matched)) {
      const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
      setPhase('won');
      if (!savedEndRef.current && uid) {
        savedEndRef.current = true;
        saveMinigameCompleted(uid, game.id, elapsed).catch(() => {});
      }
    }
  }, [cards, phase]);

  function handleFlip(idx) {
    if (locked || phase !== 'playing') return;
    const card = cards[idx];
    if (card.flipped || card.matched) return;
    if (selected.length === 1 && selected[0] === idx) return;

    const newSelected = [...selected, idx];
    setCards(prev => prev.map((c, i) => i === idx ? { ...c, flipped: true } : c));

    if (newSelected.length === 2) {
      setSelected([]);
      setLocked(true);
      const [a, b] = newSelected;
      setTimeout(() => {
        setCards(prev => {
          const match = prev[a].team === prev[b].team;
          return prev.map((c, i) => {
            if (i === a || i === b) {
              return match ? { ...c, matched: true } : { ...c, flipped: false };
            }
            return c;
          });
        });
        setLocked(false);
      }, 700);
    } else {
      setSelected(newSelected);
    }
  }

  const matchedPairs = cards.filter(c => c.matched).length / 2;
  const pct = Math.round((timeLeft / timeLimit) * 100);
  const timerColor = timeLeft <= 10 ? '#ef4444' : timeLeft <= 20 ? '#f59e0b' : 'var(--green)';

  return (
    <div className="memory-game">
      {/* Header */}
      <div className="memory-header">
        <span className="memory-pairs-count">
          {matchedPairs}/{pairsCount} <span style={{ color: 'var(--muted)', fontSize: '.75rem' }}>parejas</span>
        </span>
        <div className="memory-timer-wrap">
          <div className="memory-timer-bar" style={{ '--pct': `${pct}%`, '--color': timerColor }} />
          <span className="memory-timer-label" style={{ color: timerColor }}>⏱ {timeLeft}s</span>
        </div>
      </div>

      {/* Result screens */}
      {phase === 'won' && (
        <div className="memory-result memory-result--won">
          <div className="memory-result-icon">🎉</div>
          <div className="memory-result-title">¡Todas las parejas!</div>
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

      {/* Grid */}
      {phase === 'playing' && (
        <div className="memory-grid">
          {cards.map((card, idx) => (
            <button
              key={card.id}
              className={`memory-card${card.flipped || card.matched ? ' flipped' : ''}${card.matched ? ' matched' : ''}`}
              onClick={() => handleFlip(idx)}
              disabled={card.matched || locked || phase !== 'playing'}
              aria-label={card.flipped || card.matched ? card.team : 'Carta oculta'}
            >
              <div className="memory-card-inner">
                <div className="memory-card-back">
                  <img src={`${import.meta.env.BASE_URL}app-icon.png`} alt="" />
                </div>
                <div className="memory-card-front">
                  <img src={crestUrl(card.team)} alt={card.team} />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
