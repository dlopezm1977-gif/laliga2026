import { useState, useEffect } from 'react';
import { getAllScores } from '../../lib/firestore';
import LoadingSpinner from '../LoadingSpinner';

function initials(name) {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

const MEDALS = ['🥇', '🥈', '🥉'];

function posClass(i) {
  if (i === 0) return 'gold';
  if (i === 1) return 'silver';
  if (i === 2) return 'bronze';
  return '';
}

function RankingRow({ entry, position, isOpen, onToggle }) {
  const { username, totalPoints = 0, exactCount = 0, signCount = 0, matchdaysPlayed = 0, byMatchday } = entry;

  return (
    <>
      <div className="ranking-row" onClick={onToggle}>
        <span className={`rank-pos ${posClass(position)}`}>
          {MEDALS[position] || position + 1}
        </span>
        <div className="rank-avatar">{initials(username)}</div>
        <div className="rank-name">{username || 'Usuario'}</div>
        <div className="rank-stats">
          <div>{exactCount} exactos</div>
          <div>{signCount} signos</div>
          <div>{matchdaysPlayed} jornadas</div>
        </div>
        <div className="rank-pts">{totalPoints}</div>
      </div>
      {isOpen && byMatchday && (
        <div className="rank-detail">
          {Object.entries(byMatchday)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([md, stats]) => (
              <div className="rank-detail-row" key={md}>
                <span>Jornada {md}</span>
                <span>{stats.exact ?? 0}✓ {stats.sign ?? 0}≈</span>
                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{stats.points ?? 0} pts</span>
              </div>
            ))}
        </div>
      )}
    </>
  );
}

export default function RankingTab() {
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openUid, setOpenUid] = useState(null);

  useEffect(() => {
    getAllScores()
      .then(setScores)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner text="Cargando ranking…" />;

  if (scores.length === 0) {
    return (
      <div className="loading">
        Aún no hay puntuaciones. Empieza en cuanto terminen los primeros partidos.
      </div>
    );
  }

  return (
    <>
      <div style={{ marginBottom: '1rem' }}>
        <h2 style={{ fontFamily: 'var(--display)', fontSize: '1.3rem', color: 'var(--accent)', letterSpacing: '.06em' }}>
          Clasificación
        </h2>
        <p style={{ fontSize: '.72rem', color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
          Exacto: 3 pts · Signo: 1 pt · Toca una fila para ver el detalle
        </p>
      </div>
      {scores.map((entry, i) => (
        <RankingRow
          key={entry.uid}
          entry={entry}
          position={i}
          isOpen={openUid === entry.uid}
          onToggle={() => setOpenUid(openUid === entry.uid ? null : entry.uid)}
        />
      ))}
    </>
  );
}
