import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

function getMadrid10amUTC(dateStrMadrid) {
  // Devuelve el timestamp UTC correspondiente a las 10:00 hora española del día dado ("YYYY-MM-DD")
  for (const h of [7, 8, 9, 10]) {
    const candidate = new Date(`${dateStrMadrid}T${String(h).padStart(2, '0')}:00:00Z`);
    const mh = parseInt(new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Madrid', hour: '2-digit', hour12: false,
    }).format(candidate)) % 24;
    if (mh === 10) return candidate;
  }
}

function detectCurrentMatchday(matchdayData) {
  const now = new Date();
  const mds = Object.keys(matchdayData).map(Number).sort((a, b) => a - b);

  // 1. Partidos en juego ahora mismo
  for (const md of mds) {
    if (matchdayData[md].some(m => m.status === 'IN_PLAY' || m.status === 'PAUSED')) return md;
  }

  // 2. Ventana "hoy": de las 10:00 Madrid más recientes a las 10:00 Madrid del día siguiente
  //    Si son menos de las 10h, la ventana es la de ayer (seguimos mostrando los partidos de ayer)
  const madridHour = parseInt(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Madrid', hour: '2-digit', hour12: false,
  }).format(now)) % 24;

  const refDate = new Date(now);
  if (madridHour < 10) refDate.setUTCDate(refDate.getUTCDate() - 1);
  const refDateStr = refDate.toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });

  const winStart = getMadrid10amUTC(refDateStr).getTime();
  const winEnd   = winStart + 24 * 60 * 60 * 1000;

  // Jornada con el partido más temprano dentro de la ventana (sin importar si ya terminó)
  let todayEarliest = Infinity, todayMd = null;
  for (const md of mds) {
    for (const m of matchdayData[md]) {
      const t = new Date(m.utcDate).getTime();
      if (t >= winStart && t < winEnd && t < todayEarliest) {
        todayEarliest = t; todayMd = md;
      }
    }
  }
  if (todayMd !== null) return todayMd;

  // 3. Sin partidos hoy → jornada con el próximo partido pendiente
  let earliest = Infinity, nextMd = null;
  for (const md of mds) {
    for (const m of matchdayData[md]) {
      if (m.status === 'FINISHED') continue;
      const t = new Date(m.utcDate).getTime();
      if (t < earliest) { earliest = t; nextMd = md; }
    }
  }
  if (nextMd !== null) return nextMd;

  // 4. Todo jugado → última jornada
  return mds[mds.length - 1] || 1;
}

export function useMatches() {
  const [matchdayData, setMatchdayData]       = useState({});
  const [currentMatchday, setCurrentMatchday] = useState(1);
  const [loading, setLoading]                 = useState(true);
  const [error, setError]                     = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const snap = await getDocs(collection(db, 'matches_cache'));
        if (snap.empty) {
          setError('No hay datos todavía. El sync aún no ha ejecutado.');
          return;
        }
        const all = {};
        snap.forEach(d => { all[Number(d.id)] = d.data().matches || []; });
        setMatchdayData(all);
        setCurrentMatchday(detectCurrentMatchday(all));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function getMatches(md) {
    return matchdayData[md] || [];
  }

  const totalMatchdays = Object.keys(matchdayData).length || 38;

  return { matchdayData, currentMatchday, getMatches, totalMatchdays, loading, error };
}
