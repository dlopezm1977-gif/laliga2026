import { useState, useCallback } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function useMatchDetailRffm() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [matchId, setMatchId] = useState(null);

  const open = useCallback(async (id) => {
    setMatchId(id);
    setData(null);
    setError(null);
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, 'match_detail_cache_rffm', String(id)));
      if (!snap.exists()) throw new Error('Acta no disponible todavía.');
      setData(snap.data());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const close = useCallback(() => {
    setMatchId(null);
    setData(null);
    setError(null);
  }, []);

  return {
    detail:    data?.detail    ?? null,
    lineups:   data?.lineups   ?? null,
    incidents: data?.incidents ?? null,
    referees:  data?.referees  ?? null,
    loading, error, matchId, open, close,
  };
}
