export const ABBR = {
  'A.D. COLMENAR VIEJO B':                   'COL',
  'A.D. UNION ADARVE D':                     'ADR',
  'ARAVACA C.F. - CEIBA B':                  'ARV',
  'ATLETICO CHOPERA ALCOBENDAS 04 C':        'CHO',
  'C.D. CARRANZA A':                         'CAR',
  'C.D. FUTBOL TRES CANTOS B':              'TRC',
  'C.D.E. ACADEMIA DE FUTBOL ALCOBENDAS A': 'ACA',
  'C.F. SAN AGUSTIN DE GUADALIX A':         'GDX',
  'CELTIC CASTILLA C.F. A':                 'CEL',
  'CLUB FUENTELARREYNA A':                  'FUE',
  'CLUB SAN AGUSTIN':                       'SAG',
  'DEPORTIVO A.V. SANTA ANA B':             'SAN',
  'ESC.FUT. SIETE PICOS COLMENAR A':        'SPC',
  'FUNDACION ADF A':                        'ADF',
  'JUVENTUD SANSE B':                       'SNS',
  'RECREATIVO SOTO DEL REAL C.F. A':        'SOT',
  'S.A.D. FUNDACIÓN C.D. RECUERDO A':       'REC',
  'S.A.D. OCIO Y DEPORTE CANAL A':          'CAN',
};

export const SHORT = {
  'A.D. COLMENAR VIEJO B':                   'Colmenar Viejo B',
  'A.D. UNION ADARVE D':                     'Adarve D',
  'ARAVACA C.F. - CEIBA B':                  'Aravaca B',
  'ATLETICO CHOPERA ALCOBENDAS 04 C':        'Chopera Alcobendas C',
  'C.D. CARRANZA A':                         'Carranza A',
  'C.D. FUTBOL TRES CANTOS B':              'Tres Cantos B',
  'C.D.E. ACADEMIA DE FUTBOL ALCOBENDAS A': 'Academia Alcobendas A',
  'C.F. SAN AGUSTIN DE GUADALIX A':         'San Agustín Guadalix A',
  'CELTIC CASTILLA C.F. A':                 'Celtic A',
  'CLUB FUENTELARREYNA A':                  'Fuentelarreyna A',
  'CLUB SAN AGUSTIN':                       'San Agustín',
  'DEPORTIVO A.V. SANTA ANA B':             'Santa Ana B',
  'ESC.FUT. SIETE PICOS COLMENAR A':        'Siete Picos A',
  'FUNDACION ADF A':                        'Fundación A',
  'JUVENTUD SANSE B':                       'Juv. Sanse B',
  'RECREATIVO SOTO DEL REAL C.F. A':        'Soto del Real A',
  'S.A.D. FUNDACIÓN C.D. RECUERDO A':       'Fund. Recuerdo A',
  'S.A.D. OCIO Y DEPORTE CANAL A':          'Canal A',
};

export const shortName = name => SHORT[name] ?? name;
export const abbr      = name => ABBR[name]  ?? name.slice(0, 3).toUpperCase();
