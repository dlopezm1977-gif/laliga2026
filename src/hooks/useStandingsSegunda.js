import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function useStandingsSegunda() {
  const [standings, setStandings] = useState([]);
  const [zones, setZones]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const snap = await getDoc(doc(db, 'standings_cache_segunda', 'current'));
        if (!snap.exists()) {
          setError('No hay clasificación de Segunda todavía. El sync aún no ha ejecutado.');
          return;
        }
        const data = snap.data();
        setStandings(data.standings || []);
        setZones(data.zones || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return { standings, zones, loading, error };
}
