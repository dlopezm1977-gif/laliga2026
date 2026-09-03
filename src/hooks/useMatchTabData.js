import { useState, useCallback, useRef } from 'react';

const BASE_URL = 'https://sports.bzzoiro.com/api/v2';
const TOKEN    = import.meta.env.VITE_BZZOIRO_TOKEN;

function useLazyFetch(path) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const fetchedRef = useRef(false);

  const load = useCallback(async (matchId) => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_URL}/events/${matchId}/${path}`, {
        headers: { Authorization: `Token ${TOKEN}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (err) {
      fetchedRef.current = false;
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [path]);

  return { data, loading, error, load };
}

export function useMatchTabData() {
  const stats     = useLazyFetch('stats');
  const lineups   = useLazyFetch('lineups');
  const incidents = useLazyFetch('incidents');
  return { stats, lineups, incidents };
}
