const slugify = name =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, '-');

export const crestUrl = name =>
  name && typeof name === 'string'
    ? `${import.meta.env.BASE_URL}crests/${slugify(name)}.png`
    : `${import.meta.env.BASE_URL}crests/unknown.png`;

const ABBR_MAP = {
  'Real Madrid':   'RMA', 'Barcelona':     'BAR', 'Atlético':      'ATL',
  'Sevilla':       'SEV', 'Betis':         'BET', 'Real Sociedad': 'RSO',
  'Villarreal':    'VIL', 'Athletic':      'ATH', 'Valencia':      'VAL',
  'Osasuna':       'OSA', 'Celta':         'CEL', 'Getafe':        'GET',
  'Rayo':          'RAY', 'Alavés':        'ALA', 'Espanyol':      'ESP',
  'Racing':        'RAC', 'Levante':       'LEV', 'Deportivo':     'DEP',
  'Elche':         'ELC', 'Málaga':        'MÁL',
};

export const teamAbbr = name => ABBR_MAP[name] || name.slice(0, 3).toUpperCase();

export const crestUrlSegunda = name =>
  name && typeof name === 'string'
    ? `${import.meta.env.BASE_URL}crests-segunda/${slugify(name)}.png`
    : `${import.meta.env.BASE_URL}crests-segunda/unknown.png`;

// logoPath es el valor almacenado en Firestore: "crests-rffm/1313.jpg"
export const crestUrlRffm = logoPath =>
  logoPath
    ? `${import.meta.env.BASE_URL}${logoPath}`
    : `${import.meta.env.BASE_URL}crests-rffm/unknown.png`;
