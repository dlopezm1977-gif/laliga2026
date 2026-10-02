import { useState, useEffect, useRef } from 'react';
import { crestUrl } from '../../lib/crests';
import { saveMinigameStarted, saveMinigameCompleted } from '../../lib/firestore';

const ALL_TEAMS = [
  'Real Madrid', 'Barcelona', 'Atlético', 'Sevilla', 'Betis',
  'Real Sociedad', 'Villarreal', 'Athletic', 'Valencia', 'Osasuna',
  'Celta', 'Getafe', 'Rayo', 'Alavés', 'Espanyol',
  'Racing', 'Levante', 'Deportivo', 'Elche', 'Málaga',
];

const LEVELS     = [2, 3, 4, 5]; // sequence lengths per level (independent)
const TIME_LIMIT = 60;
const SHOW_MS    = 800;
const GAP_MS     = 300;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function SequenceRecallGame({ game, uid, onFinish, replay = false }) {
  const timeLimit = game.timeLimit ?? TIME_LIMIT;

  // Stable for the whole game session: 5 random teams + 4 independent sequences
  const [{ teams, sequences }] = useState(() => {
    const t = shuffle(ALL_TEAMS).slice(0, 5);
    const seqs = LEVELS.map(len =>
      Array.from({ length: len }, () => t[Math.floor(Math.random() * 5)])
    );
    return { teams: t, sequences: seqs };
  });

  const [level,      setLevel]      = useState(0);
  // phases: 'showing' | 'input' | 'levelwon' | 'won' | 'timeout'
  const [phase,      setPhase]      = useState('showing');
  const [showingIdx, setShowingIdx] = useState(-1);
  const [userInput,  setUserInput]  = useState([]);
  const [timeLeft,   setTimeLeft]   = useState(timeLimit);
  const [wrongFlash, setWrongFlash] = useState(false);

  const startTimeRef  = useRef(Date.now());
  const savedStartRef = useRef(false);
  const savedEndRef   = useRef(false);
  const cancelAnimRef = useRef(false);

  // Save start on mount
  useEffect(() => {
    if (!replay && !savedStartRef.current && uid) {
      savedStartRef.current = true;
      saveMinigameStarted(uid, game.id).catch(() => {});
    }
  }, []);

  // Timer — only ticks during input phase
  useEffect(() => {
    if (phase !== 'input') return;
    if (timeLeft <= 0) { setPhase('timeout'); return; }
    const t = setTimeout(() => setTimeLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, phase]);

  // Level won — pause 1s showing all slots green, then advance (or finish)
  useEffect(() => {
    if (phase !== 'levelwon') return;
    const t = setTimeout(() => {
      if (level === LEVELS.length - 1) {
        setPhase('won');
      } else {
        setUserInput([]);
        setLevel(l => l + 1);
        setPhase('showing');
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [phase, level]);

  // Save win
  useEffect(() => {
    if (phase !== 'won' || replay || savedEndRef.current || !uid) return;
    savedEndRef.current = true;
    const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
    saveMinigameCompleted(uid, game.id, elapsed).catch(() => {});
  }, [phase]);

  // Simon animation — runs whenever we enter 'showing' phase
  useEffect(() => {
    if (phase !== 'showing') return;
    cancelAnimRef.current = false;

    const seq = sequences[level];
    let step = 0;

    function tick() {
      if (cancelAnimRef.current) return;
      if (step >= seq.length) {
        setShowingIdx(-1);
        setPhase('input');
        return;
      }
      setShowingIdx(step);
      step++;
      setTimeout(() => {
        if (cancelAnimRef.current) return;
        setShowingIdx(-1);
        setTimeout(tick, GAP_MS);
      }, SHOW_MS);
    }

    const t = setTimeout(tick, 600);
    return () => {
      cancelAnimRef.current = true;
      clearTimeout(t);
    };
  }, [phase, level]);

  function handleSelect(team) {
    if (phase !== 'input' || wrongFlash) return;

    const seq     = sequences[level];
    const nextIdx = userInput.length;

    if (team !== seq[nextIdx]) {
      setWrongFlash(true);
      setTimeout(() => {
        setWrongFlash(false);
        setUserInput([]);
        setPhase('showing');
      }, 700);
      return;
    }

    const newInput = [...userInput, team];
    if (newInput.length < seq.length) {
      setUserInput(newInput);
      return;
    }

    // Level complete — always pause 1s on green before advancing or finishing
    setUserInput(newInput);
    setPhase('levelwon');
  }

  const seq        = sequences[level];
  const pct        = Math.round((timeLeft / timeLimit) * 100);
  const timerColor = timeLeft <= 10 ? '#ef4444' : timeLeft <= 20 ? '#f59e0b' : 'var(--green)';
  const backImg    = game.imageUrl ?? `${import.meta.env.BASE_URL}app-icon.png`;
  const isGameArea = phase === 'showing' || phase === 'input' || phase === 'levelwon';

  return (
    <div className="memory-game">
      {/* Header */}
      <div className="memory-header">
        <span className="memory-pairs-count">
          Nivel {level + 1}<span style={{ color: 'var(--muted)', fontSize: '.8rem' }}>/4</span>
        </span>
        <div className="memory-timer-wrap">
          <div className="memory-timer-bar"
            style={{ '--pct': `${pct}%`, '--color': phase === 'input' ? timerColor : 'var(--border)' }} />
          <span className="memory-timer-label" style={{ color: phase === 'input' ? timerColor : 'var(--muted)' }}>
            {phase === 'showing' || phase === 'levelwon' ? '⏸' : '⏱'} {timeLeft}s
          </span>
        </div>
      </div>

      {/* Result screens */}
      {phase === 'won' && (
        <div className="memory-result memory-result--won">
          <div className="memory-result-icon">🎉</div>
          <div className="memory-result-title">¡Secuencia completada!</div>
          {replay
            ? <div className="memory-result-pts" style={{ color: 'var(--muted)', fontSize: '.85rem' }}>Modo repaso — sin puntos extra</div>
            : <div className="memory-result-pts">+{game.pointsComplete ?? 10} pts</div>
          }
          <button className="btn-save" style={{ marginTop: '1rem' }} onClick={onFinish}>Continuar</button>
        </div>
      )}
      {phase === 'timeout' && (
        <div className="memory-result memory-result--timeout">
          <div className="memory-result-icon">⏰</div>
          <div className="memory-result-title">¡Tiempo agotado!</div>
          {replay
            ? <div className="memory-result-pts" style={{ color: 'var(--muted)', fontSize: '.85rem' }}>Modo repaso — sin puntos extra</div>
            : <div className="memory-result-pts" style={{ color: '#f59e0b' }}>+{game.pointsStarted ?? 5} pts por participar</div>
          }
          <button className="btn-save" style={{ marginTop: '1rem' }} onClick={onFinish}>Continuar</button>
        </div>
      )}

      {/* Game area */}
      {isGameArea && (
        <div className="seq-game">
          <p className="seq-instruction">
            {phase === 'showing'
              ? '👀 Memoriza el orden…'
              : phase === 'levelwon'
                ? '✅ ¡Nivel superado!'
                : wrongFlash
                  ? '❌ Incorrecto — repitiendo…'
                  : '👆 Repite la secuencia en orden'
            }
          </p>

          {/* Sequence slots */}
          <div className="seq-display">
            {seq.map((team, i) => {
              const isLit    = showingIdx === i;
              const isFilled = (phase === 'input' || phase === 'levelwon') && i < userInput.length;
              return (
                <div
                  key={i}
                  className={`seq-slot${isLit ? ' seq-slot--lit' : ''}${isFilled ? ' seq-slot--done' : ''}${wrongFlash ? ' seq-slot--wrong' : ''}`}
                >
                  {isLit
                    ? <img src={crestUrl(team)} alt={team} />
                    : isFilled
                      ? <img src={crestUrl(userInput[i])} alt={userInput[i]} />
                      : <img src={backImg} alt="" className="seq-back-img" />
                  }
                </div>
              );
            })}
          </div>

          {/* Options */}
          <p className="seq-options-label">Escudos disponibles</p>
          <div className="seq-options">
            {teams.map(team => (
              <button
                key={team}
                className="seq-option"
                onClick={() => handleSelect(team)}
                disabled={phase !== 'input' || wrongFlash}
              >
                <img src={crestUrl(team)} alt={team} />
                <span>{team}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
