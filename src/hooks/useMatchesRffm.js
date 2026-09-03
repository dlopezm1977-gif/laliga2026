import { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

function detectCurrentRound(roundData) {
  const rounds = Object.keys(roundData).map(Number).sort((a, b) => a - b);
  if (!rounds.length) return 1;

  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });

  for (const rd of rounds) {
    if (roundData[rd].some(m => m.status === 'live')) return rd;
  }

  const todayRound = rounds.find(rd =>
    roundData[rd].some(m => m.fecha?.slice(0, 10) === today)
  );
  if (todayRound) return todayRound;

  const nextRound = rounds.find(rd =>
    roundData[rd].some(m => m.status !== 'finished' && m.fecha && m.fecha.slice(0, 10) >= today)
  );
  if (nextRound) return nextRound;

  return rounds[rounds.length - 1];
}

export function useMatchesRffm() {
  const [roundData, setRoundData]       = useState({});
  const [currentRound, setCurrentRound] = useState(1);
  const [totalRounds, setTotalRounds]   = useState(34);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [metaSnap, roundsSnap] = await Promise.all([
          getDoc(doc(db, 'matches_cache_rffm', 'meta')),
          getDocs(collection(db, 'matches_cache_rffm')),
        ]);

        const meta = metaSnap.exists() ? metaSnap.data() : {};
        const all = {};
        roundsSnap.forEach(d => {
          if (d.id === 'meta') return;
          const rd = parseInt(d.id, 10);
          if (!isNaN(rd)) all[rd] = d.data().matches ?? [];
        });

        setRoundData(all);
        const knownRounds = Object.keys(all).length;
        setTotalRounds(meta.totalRounds != null ? meta.totalRounds : (knownRounds > 0 ? knownRounds : 34));
        setCurrentRound(
          meta.currentRound != null ? meta.currentRound : detectCurrentRound(all)
        );
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function getMatches(rd) {
    return roundData[rd] ?? [];
  }

  return { roundData, currentRound, getMatches, totalRounds, loading, error };
}
