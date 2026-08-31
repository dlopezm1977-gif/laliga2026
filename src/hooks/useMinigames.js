import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function useMinigames(uid) {
  const [minigames, setMinigames] = useState([]);
  const [userResults, setUserResults] = useState({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, 'minigames'));
      const games = [];
      snap.forEach(d => games.push({ id: d.id, ...d.data() }));
      // Sort by startDate ascending
      games.sort((a, b) => (a.startDate?.toMillis?.() ?? 0) - (b.startDate?.toMillis?.() ?? 0));
      setMinigames(games);

      if (uid && games.length) {
        const results = {};
        await Promise.all(
          games.map(async g => {
            const r = await getDoc(doc(db, 'minigame_results', uid, 'games', g.id));
            if (r.exists()) results[g.id] = r.data();
          })
        );
        setUserResults(results);
      }
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => { load(); }, [load]);

  const now = Date.now();

  // Minigames visible to the user: active now OR ended in last 14 days
  const visibleMinigames = minigames.filter(g => {
    const start = g.startDate?.toMillis?.() ?? 0;
    const end = g.endDate?.toMillis?.() ?? 0;
    return now >= start && now <= end + 14 * 24 * 3600 * 1000;
  });

  const activeMinigame = minigames.find(g => {
    const start = g.startDate?.toMillis?.() ?? 0;
    const end = g.endDate?.toMillis?.() ?? 0;
    return now >= start && now <= end;
  }) ?? null;

  return { minigames, visibleMinigames, activeMinigame, userResults, loading, refresh: load };
}
