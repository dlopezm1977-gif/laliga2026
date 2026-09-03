import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function useScorersRffm() {
  const [scorers, setScorers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    getDoc(doc(db, 'scorers_cache_rffm', 'current'))
      .then(snap => setScorers(snap.exists() ? (snap.data().leaders ?? []) : []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return { scorers, loading, error };
}
