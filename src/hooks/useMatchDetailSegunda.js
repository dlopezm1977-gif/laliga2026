import { useState, useCallback } from 'react';

const BASE_URL = 'https://sports.bzzoiro.com/api/v2';
const TOKEN    = import.meta.env.VITE_BZZOIRO_TOKEN;

export function useMatchDetailSegunda() {
  const [detail,  setDetail]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const open = useCallback(async (matchId) => {
    setDetail(null);
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/events/${matchId}/`, {
        headers: { Authorization: `Token ${TOKEN}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDetail(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const close = useCallback(() => {
    setDetail(null);
    setError(null);
  }, []);

  return { detail, loading, error, open, close };
}
