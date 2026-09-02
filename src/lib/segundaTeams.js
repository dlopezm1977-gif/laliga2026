export const ABBR = {
  'Granada':                'GRA',
  'CD Castellón':           'CAS',
  'Leganés':                'LEG',
  'Sporting Gijón':         'GIJ',
  'Mallorca':               'MAL',
  'CD Tenerife':            'TEN',
  'UD Las Palmas':          'LPA',
  'Eibar':                  'EIB',
  'CE Sabadell':            'SAB',
  'Girona FC':              'GIR',
  'Celta Fortuna':          'CEF',
  'Burgos Club de Fútbol':  'BUR',
  'Real Sociedad B':        'RSB',
  'Real Oviedo':            'OVI',
  'FC Andorra':             'AND',
  'Almería':                'ALM',
  'Cádiz':                  'CAD',
  'Córdoba':                'COR',
  'Real Valladolid':        'VLL',
  'CD Eldense':             'ELD',
  'Albacete Balompié':      'ALB',
  'AD Ceuta':               'CEU',
};

const CANONICAL_KEYS = Object.keys(ABBR);

// Normaliza variantes de nombre de la API al nombre canónico del mapa
// Ej: "Las Palmas" → "UD Las Palmas", "Leganes" → "Leganés"
export function canonicalize(name) {
  if (!name) return name;
  if (ABBR[name]) return name;
  const lower = name.toLowerCase();
  return CANONICAL_KEYS.find(k =>
    k.toLowerCase().includes(lower) || lower.includes(k.toLowerCase())
  ) ?? name;
}

export const abbr = name => {
  const canonical = canonicalize(name);
  return ABBR[canonical] ?? canonical?.slice(0, 3).toUpperCase() ?? '?';
};
