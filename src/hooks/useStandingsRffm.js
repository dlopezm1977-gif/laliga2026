import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function useStandingsRffm() {
  const [standings, setStandings] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  useEffect(() => {
    getDoc(doc(db, 'standings_cache_rffm', 'current'))
      .then(snap => setStandings(snap.exists() ? (snap.data().standings ?? []) : []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return { standings, loading, error };
}
