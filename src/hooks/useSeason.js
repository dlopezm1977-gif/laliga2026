import { useState, useEffect } from 'react';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { activeSeasonId, readCachedSeasons, cacheSeasons } from '../lib/seasonalTheme';

function applySeason(id) {
  if (id) document.documentElement.setAttribute('data-season', id);
  else document.documentElement.removeAttribute('data-season');
}

// Aplica data-season en <html> según la config de Firestore. Usa la última config
// cacheada para pintar sin parpadeo y la refresca en segundo plano.
export function useSeason() {
  const [season, setSeason] = useState(() => activeSeasonId(readCachedSeasons()));

  useEffect(() => { applySeason(season); }, [season]);

  useEffect(() => {
    getDoc(doc(db, 'app_config', 'seasons')).then(snap => {
      const seasons = snap.exists() ? (snap.data().seasons ?? []) : [];
      cacheSeasons(seasons);
      setSeason(activeSeasonId(seasons));
    }).catch(() => {});
  }, []);

  return season;
}
