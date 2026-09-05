import { useState, useCallback } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function useMatchDetailSegunda() {
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
      const snap = await getDoc(doc(db, 'match_detail_cache_segunda', String(id)));
      if (!snap.exists()) throw new Error('Detalle no disponible todavía. El sync lo cargará en el próximo ciclo.');
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
    stats:     data?.stats     ?? null,
    lineups:   data?.lineups   ?? null,
    incidents: data?.incidents ?? null,
    loading, error, matchId, open, close,
  };
}
