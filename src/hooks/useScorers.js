import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function useScorers() {
  const [scorers, setScorers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const snap = await getDoc(doc(db, 'scorers_cache', 'laliga'));
        if (snap.exists()) {
          setScorers(snap.data().scorers || []);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return { scorers, loading, error };
}
