import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function useStandingsMunicipal(season = null) {
  const [standings, setStandings] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setStandings([]);

    const resolveDocId = season
      ? Promise.resolve(season)
      : getDoc(doc(db, 'matches_cache_municipal', 'meta'))
          .then(snap => snap.exists() ? (snap.data().currentSeason ?? 'current') : 'current');

    resolveDocId
      .then(id => getDoc(doc(db, 'standings_cache_municipal', id)))
      .then(snap => setStandings(snap.exists() ? (snap.data().standings ?? []) : []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [season]);

  return { standings, loading, error };
}
