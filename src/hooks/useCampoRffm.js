import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function useCampoRffm(venueCode) {
  const [campo, setCampo]   = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!venueCode) { setCampo(null); return; }
    setLoading(true);
    getDoc(doc(db, 'campos_cache_rffm', String(venueCode)))
      .then(snap => setCampo(snap.exists() ? snap.data() : null))
      .catch(() => setCampo(null))
      .finally(() => setLoading(false));
  }, [venueCode]);

  return { campo, loading };
}
