export function getSeasonMonths() {
  const now = new Date();
  const [y, m] = now.toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' })
    .split('-').map(Number);
  // July onwards counts as the upcoming season start
  const s = m >= 7 ? y : y - 1;
  const e = s + 1;
  return [
    { key: `agosto-${s}`,     label: 'Agosto',     year: s, month: 8  },
    { key: `sep-${s}`,        label: 'Septiembre', year: s, month: 9  },
    { key: `octubre-${s}`,    label: 'Octubre',    year: s, month: 10 },
    { key: `noviembre-${s}`,  label: 'Noviembre',  year: s, month: 11 },
    { key: `diciembre-${s}`,  label: 'Diciembre',  year: s, month: 12 },
    { key: `enero-${e}`,      label: 'Enero',      year: e, month: 1  },
    { key: `febrero-${e}`,    label: 'Febrero',    year: e, month: 2  },
    { key: `marzo-${e}`,      label: 'Marzo',      year: e, month: 3  },
    { key: `abril-${e}`,      label: 'Abril',      year: e, month: 4  },
    { key: `mayo-${e}`,       label: 'Mayo',       year: e, month: 5  },
  ];
}

export function isMonthClosed({ year, month }) {
  const [y, m, d] = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' })
    .split('-').map(Number);
  if (y > year) return true;
  if (y < year) return false;
  if (month === 8) return m > 8 || (m === 8 && d >= 15);
  return m >= month;
}

export const SEASON_MONTHS = getSeasonMonths();

export const MONTHLY_CATEGORIES = [
  { key: 'bestPlayer', label: 'Jugador del mes',    emoji: '🏆' },
  { key: 'bestCoach',  label: 'Entrenador del mes', emoji: '👔' },
  { key: 'bestU23',    label: 'Sub-23 del mes',     emoji: '⭐' },
];
