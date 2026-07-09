import { useState, useEffect } from 'react';
import { getCachedMatchday } from '../lib/firestore';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

function detectCurrentMatchday(matchdayData) {
  const mds = Object.keys(matchdayData).map(Number).sort((a, b) => a - b);
  for (const md of mds) {
    const matches = matchdayData[md];
    const hasNotFinished = matches.some(m => m.status !== 'FINISHED');
    if (hasNotFinished) return md;
  }
  return mds[mds.length - 1] || 1;
}

export function useMatches() {
  const [matchdayData, setMatchdayData]       = useState({});
  const [currentMatchday, setCurrentMatchday] = useState(1);
  const [loading, setLoading]                 = useState(true);
  const [error, setError]                     = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const snap = await getDocs(collection(db, 'matches_cache'));
        if (snap.empty) {
          setError('No hay datos todavía. El sync aún no ha ejecutado.');
          return;
        }
        const all = {};
        snap.forEach(d => { all[Number(d.id)] = d.data().matches || []; });
        setMatchdayData(all);
        setCurrentMatchday(detectCurrentMatchday(all));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function getMatches(md) {
    return matchdayData[md] || [];
  }

  const totalMatchdays = Object.keys(matchdayData).length || 38;

  return { matchdayData, currentMatchday, getMatches, totalMatchdays, loading, error };
}
