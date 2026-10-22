// Configuración por temporada de la liga juvenil RFFM.
// La temporada en curso se lee de matches_cache_rffm/meta.currentSeason (la escribe sync-rffm.js).
export const RFFM_DEFAULT_SEASON = '2627';

export const RFFM_SEASONS = {
  '2627': {
    competition: 'Preferente Juvenil · Grupo 2',
    favorite:    'S.A.D. OCIO Y DEPORTE CANAL A',
    favoriteLogo:'crests-rffm/6819372.png',
    favoriteLabel: 'Ocio y Deporte Canal A',
    promoSpots:  2,
    relSpots:    4,
  },
  '2122': {
    competition: 'Primera Infantil · Grupo 11',
    favorite:    'S.A.D. OCIO Y DEPORTE CANAL B',
    favoriteLogo:'crests-rffm/10634103.png',
    favoriteLabel: 'Ocio y Deporte Canal B',
    promoSpots:  2,
    relSpots:    4,
  },
  '2223': {
    competition: 'Preferente Infantil · Grupo 3',
    favorite:    'S.A.D. OCIO Y DEPORTE CANAL A',
    favoriteLogo:'crests-rffm/6819595.png',
    favoriteLabel: 'Ocio y Deporte Canal A',
    promoSpots:  2,
    relSpots:    4,
  },
  '2324': {
    competition: 'Segunda Cadete · Grupo 31',
    favorite:    'S.A.D. OCIO Y DEPORTE CANAL B',
    favoriteLogo:'crests-rffm/6824262.png',
    favoriteLabel: 'Ocio y Deporte Canal B',
    promoSpots:  2,
    relSpots:    0,
  },
  '2425': {
    competition: 'Primera Cadete · Grupo 14',
    favorite:    'S.A.D. OCIO Y DEPORTE CANAL A',
    favoriteLogo:'crests-rffm/6819557.png',
    favoriteLabel: 'Ocio y Deporte Canal A',
    promoSpots:  2,
    relSpots:    4,
  },
  '2526': {
    competition: 'Segunda Juvenil · Grupo 27',
    favorite:    'S.A.D. OCIO Y DEPORTE CANAL B',
    favoriteLogo:'crests-rffm/6819374.png',
    favoriteLabel: 'Ocio y Deporte Canal B',
    promoSpots:  5,
    maybePromoSpots: 1,   // 6º asciende solo si es de los mejores sextos de todos los grupos
    relSpots:    0,
  },
};

export const rffmSeasonConfig = season => RFFM_SEASONS[season] ?? RFFM_SEASONS[RFFM_DEFAULT_SEASON];
