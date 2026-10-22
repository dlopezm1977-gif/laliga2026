import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { RFFM_DEFAULT_SEASON } from '../lib/rffmSeasons';

// Temporada en curso → doc 'current'; archivadas → doc '{temporada}'
export function useScorersRffm(season = null) {
  const [scorers, setScorers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setScorers([]);

    getDoc(doc(db, 'matches_cache_rffm', 'meta'))
      .then(meta => {
        const cur = (meta.exists() && meta.data().currentSeason) || RFFM_DEFAULT_SEASON;
        const id = !season || season === cur ? 'current' : season;
        return getDoc(doc(db, 'scorers_cache_rffm', id));
      })
      .then(snap => { if (!cancelled) setScorers(snap.exists() ? (snap.data().leaders ?? []) : []); })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [season]);

  return { scorers, loading, error };
}
