import { useState, useCallback } from 'react';

const BASE_URL = 'https://sports.bzzoiro.com/api/v2';
const TOKEN    = import.meta.env.VITE_BZZOIRO_TOKEN;

export function useMatchDetailSegunda() {
  const [detail,  setDetail]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [matchId, setMatchId] = useState(null);

  const open = useCallback(async (id) => {
    setMatchId(id);
    setDetail(null);
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/events/${id}/`, {
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
    setMatchId(null);
    setDetail(null);
    setError(null);
  }, []);

  return { detail, loading, error, matchId, open, close };
}
