import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

// Estados de partido en la API bzzoiro
const LIVE_STATUSES    = new Set(['live', 'in_progress', 'halftime']);
const FINISHED_STATUS  = 'finished';

function getMadrid10amUTC(dateStr) {
  for (const h of [7, 8, 9, 10]) {
    const candidate = new Date(`${dateStr}T${String(h).padStart(2, '0')}:00:00Z`);
    const mh = parseInt(new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Madrid', hour: '2-digit', hour12: false,
    }).format(candidate)) % 24;
    if (mh === 10) return candidate;
  }
}

function detectCurrentRound(roundData) {
  const now = new Date();
  const rounds = Object.keys(roundData).map(Number).sort((a, b) => a - b);

  for (const rd of rounds) {
    if (roundData[rd].some(m => LIVE_STATUSES.has(m.status))) return rd;
  }

  const madridHour = parseInt(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Madrid', hour: '2-digit', hour12: false,
  }).format(now)) % 24;

  const refDate = new Date(now);
  if (madridHour < 10) refDate.setUTCDate(refDate.getUTCDate() - 1);
  const refDateStr = refDate.toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });

  const winStart = getMadrid10amUTC(refDateStr).getTime();
  const winEnd   = winStart + 24 * 60 * 60 * 1000;

  let todayEarliest = Infinity, todayRd = null;
  for (const rd of rounds) {
    for (const m of roundData[rd]) {
      const t = new Date(m.utcDate).getTime();
      if (t >= winStart && t < winEnd && t < todayEarliest) {
        todayEarliest = t; todayRd = rd;
      }
    }
  }
  if (todayRd !== null) return todayRd;

  let earliest = Infinity, nextRd = null;
  for (const rd of rounds) {
    for (const m of roundData[rd]) {
      if (m.status === FINISHED_STATUS) continue;
      const t = new Date(m.utcDate).getTime();
      if (t < earliest) { earliest = t; nextRd = rd; }
    }
  }
  if (nextRd !== null) return nextRd;

  return rounds[rounds.length - 1] || 1;
}

export function useMatchesSegunda() {
  const [roundData, setRoundData]       = useState({});
  const [currentRound, setCurrentRound] = useState(1);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const snap = await getDocs(collection(db, 'matches_cache_segunda'));
        if (snap.empty) {
          setError('No hay datos de Segunda todavía. El sync aún no ha ejecutado.');
          return;
        }
        const all = {};
        snap.forEach(d => { all[Number(d.id)] = d.data().matches || []; });
        setRoundData(all);
        setCurrentRound(detectCurrentRound(all));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function getMatches(rd) {
    return roundData[rd] || [];
  }

  const totalRounds = Object.keys(roundData).length || 42;

  return { roundData, currentRound, getMatches, totalRounds, loading, error };
}
