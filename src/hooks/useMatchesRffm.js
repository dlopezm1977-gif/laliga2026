import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { RFFM_DEFAULT_SEASON } from '../lib/rffmSeasons';

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

// La temporada en curso usa IDs numéricos ("12"); las archivadas "{temporada}_{jornada}" ("2526_12").
export function useMatchesRffm(season = null) {
  const [roundData, setRoundData]         = useState({});
  const [currentRound, setCurrentRound]   = useState(1);
  const [totalRounds, setTotalRounds]     = useState(34);
  const [currentSeason, setCurrentSeason] = useState(null);
  const [seasons, setSeasons]             = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);

  const loadId = useRef(0);

  const load = useCallback(async () => {
    const myId = ++loadId.current;
    setLoading(true);
    setError(null);
    try {
      const [metaSnap, roundsSnap] = await Promise.all([
        getDoc(doc(db, 'matches_cache_rffm', 'meta')),
        getDocs(collection(db, 'matches_cache_rffm')),
      ]);
      if (myId !== loadId.current) return; // respuesta obsoleta de otra temporada

      const meta = metaSnap.exists() ? metaSnap.data() : {};
      const cur = meta.currentSeason ?? RFFM_DEFAULT_SEASON;
      const active = season ?? cur;
      const isCurrent = active === cur;
      setCurrentSeason(cur);
      setSeasons([...new Set([...(meta.seasons ?? []), cur])].sort());

      const prefix = `${active}_`;
      const all = {};
      roundsSnap.forEach(d => {
        if (isCurrent) {
          if (/^\d+$/.test(d.id)) all[parseInt(d.id, 10)] = d.data().matches ?? [];
        } else if (d.id.startsWith(prefix) && /^\d+$/.test(d.id.slice(prefix.length))) {
          all[parseInt(d.id.slice(prefix.length), 10)] = d.data().matches ?? [];
        }
      });

      setRoundData(all);
      const knownRounds = Object.keys(all).length;
      if (isCurrent) {
        setTotalRounds(meta.totalRounds != null ? meta.totalRounds : (knownRounds > 0 ? knownRounds : 34));
        setCurrentRound(meta.currentRound != null ? meta.currentRound : detectCurrentRound(all));
      } else {
        setTotalRounds(knownRounds > 0 ? Math.max(...Object.keys(all).map(Number)) : 34);
        setCurrentRound(detectCurrentRound(all));
      }
    } catch (err) {
      if (myId === loadId.current) setError(err.message);
    } finally {
      if (myId === loadId.current) setLoading(false);
    }
  }, [season]);

  useEffect(() => { load(); }, [load]);

  function getMatches(rd) {
    return roundData[rd] ?? [];
  }

  return { roundData, currentRound, getMatches, totalRounds, currentSeason, seasons, loading, error, refresh: load };
}
