import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function useScorersSegunda() {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const snap = await getDoc(doc(db, 'scorers_cache_segunda', 'current'));
        if (!snap.exists()) {
          setError('No hay datos de goleadores todavía.');
          return;
        }
        setLeaders(snap.data().leaders || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return { leaders, loading, error };
}
