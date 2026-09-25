const slugify = name =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, '-');

const SHORT_NAMES = {
  'Real Madrid':              'Real Madrid',
  'FC Barcelona':             'Barcelona',
  'Barcelona':                'Barcelona',
  'Atletico de Madrid':       'Atlético',
  'Atlético Madrid':          'Atlético',
  'Club Atletico de Madrid':  'Atlético',
  'Sevilla FC':               'Sevilla',
  'Sevilla':                  'Sevilla',
  'Real Betis':               'Betis',
  'Real Sociedad':            'Real Sociedad',
  'Villarreal CF':            'Villarreal',
  'Villarreal':               'Villarreal',
  'Athletic Club':            'Athletic',
  'Valencia CF':              'Valencia',
  'Valencia':                 'Valencia',
  'CA Osasuna':               'Osasuna',
  'Osasuna':                  'Osasuna',
  'Celta de Vigo':            'Celta',
  'Celta Vigo':               'Celta',
  'RC Celta':                 'Celta',
  'Getafe CF':                'Getafe',
  'Getafe':                   'Getafe',
  'Rayo Vallecano':           'Rayo',
  'Deportivo Alaves':         'Alavés',
  'Deportivo Alavés':         'Alavés',
  'Alaves':                   'Alavés',
  'RCD Espanyol':             'Espanyol',
  'Espanyol':                 'Espanyol',
  'Racing Santander':         'Racing',
  'Real Racing Club':         'Racing',
  'Levante UD':               'Levante',
  'Levante':                  'Levante',
  'Deportivo de La Coruna':   'Deportivo',
  'Deportivo de A Coruña':    'Deportivo',
  'RC Deportivo':             'Deportivo',
  'Elche CF':                 'Elche',
  'Elche':                    'Elche',
  'Malaga CF':                'Málaga',
  'Málaga CF':                'Málaga',
  'Malaga':                   'Málaga',
};

export const shortName = name => (name && SHORT_NAMES[name]) || name;

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

export const crestUrlMunicipal = name =>
  name && typeof name === 'string'
    ? `${import.meta.env.BASE_URL}crests-municipal/${slugify(name)}.png`
    : `${import.meta.env.BASE_URL}crests-municipal/unknown.svg`;

export const crestUrlMunicipalFallback = name =>
  name && typeof name === 'string'
    ? `${import.meta.env.BASE_URL}crests-municipal/${slugify(name)}.svg`
    : `${import.meta.env.BASE_URL}crests-municipal/unknown.svg`;
