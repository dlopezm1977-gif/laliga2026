import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

function detectCurrentRound(roundData) {
  const rounds = Object.keys(roundData).map(Number).sort((a, b) => a - b);
  if (!rounds.length) return 1;
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  const todayRound = rounds.find(rd => roundData[rd].some(m => m.fecha === today));
  if (todayRound) return todayRound;
  const nextRound = rounds.find(rd => roundData[rd].some(m => m.status === 'scheduled' && m.fecha >= today));
  if (nextRound) return nextRound;
  return rounds[rounds.length - 1];
}

export function useMatchesMunicipal(season = null) {
  const [roundData, setRoundData]         = useState({});
  const [currentRound, setCurrentRound]   = useState(1);
  const [totalRounds, setTotalRounds]     = useState(22);
  const [currentSeason, setCurrentSeason] = useState(null);
  const [seasons, setSeasons]             = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [metaSnap, roundsSnap] = await Promise.all([
        getDoc(doc(db, 'matches_cache_municipal', 'meta')),
        getDocs(collection(db, 'matches_cache_municipal')),
      ]);

      const meta = metaSnap.exists() ? metaSnap.data() : {};
      const activeSeason = season ?? meta.currentSeason ?? null;
      setCurrentSeason(meta.currentSeason ?? null);
      setSeasons(meta.seasons ?? (activeSeason ? [activeSeason] : []));

      const all = {};
      roundsSnap.forEach(d => {
        if (d.id === 'meta') return;
        if (activeSeason) {
          const prefix = `${activeSeason}_`;
          if (d.id.startsWith(prefix)) {
            const rd = parseInt(d.id.slice(prefix.length), 10);
            if (!isNaN(rd)) all[rd] = d.data().matches ?? [];
          }
        } else {
          // Formato antiguo: IDs numéricos sin prefijo de temporada
          const rd = parseInt(d.id, 10);
          if (!isNaN(rd)) all[rd] = d.data().matches ?? [];
        }
      });

      setRoundData(all);
      const knownRounds = Object.keys(all).length;
      setTotalRounds(knownRounds > 0 ? knownRounds : 22);

      const isCurrentSeason = !season || season === meta.currentSeason;
      setCurrentRound(
        isCurrentSeason && meta.currentRound != null
          ? meta.currentRound
          : detectCurrentRound(all)
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [season]);

  useEffect(() => { load(); }, [load]);

  function getMatches(rd) {
    return roundData[rd] ?? [];
  }

  return { roundData, currentRound, getMatches, totalRounds, currentSeason, seasons, loading, error, refresh: load };
}
