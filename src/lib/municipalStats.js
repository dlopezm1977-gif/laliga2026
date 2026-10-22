const FAVORITE_TEAM = 'ASTON BIRRA';

const norm = s => (s ?? '').trim().toLowerCase();

// Agrega las actas manuales del Aston Birra: partidos jugados, goles y tarjetas por jugador,
// con el desglose jornada a jornada (`partidos`) de todos los partidos con acta.
// Los goles en propia puerta (tipo 'pp') no cuentan para el jugador.
export function computeMunicipalStats(roundData) {
  const players = new Map();
  const get = p => {
    const key = norm(p.nombre);
    if (!players.has(key)) players.set(key, { nombre: p.nombre.trim(), pj: 0, goles: 0, amarillas: 0, rojas: 0, porPartido: new Map() });
    return players.get(key);
  };

  // Partidos con acta del Aston Birra, en orden de jornada
  const games = [];
  for (const round of Object.keys(roundData).map(Number).sort((a, b) => a - b)) {
    for (const m of roundData[round]) {
      const side = m.homeTeam === FAVORITE_TEAM ? 'home' : m.awayTeam === FAVORITE_TEAM ? 'away' : null;
      if (!side || !m.detail) continue;
      const rival = side === 'home' ? 'away' : 'home';
      games.push({
        round,
        side,
        rival: m[`${rival}Team`],
        gf: m[`${side}Score`],
        gc: m[`${rival}Score`],
        detail: m.detail,
        match: m,
      });
    }
  }

  games.forEach((g, gi) => {
    const entry = p => {
      const pl = get(p);
      if (!pl.porPartido.has(gi)) pl.porPartido.set(gi, { jugado: false, goles: 0, amarillas: 0, rojas: 0 });
      return [pl, pl.porPartido.get(gi)];
    };
    const { side, detail: d } = g;

    for (const p of d[side] ?? []) {
      if (!p.nombre?.trim()) continue;
      const [pl, e] = entry(p);
      pl.pj++; e.jugado = true;
    }
    for (const x of d.goals ?? []) {
      if (x.team !== side || !x.nombre?.trim() || x.tipo === 'pp') continue;
      const [pl, e] = entry(x);
      pl.goles++; e.goles++;
    }
    for (const c of d.cards ?? []) {
      if (c.team !== side || !c.nombre?.trim()) continue;
      const [pl, e] = entry(c);
      if (c.tipo === 'roja') { pl.rojas++; e.rojas++; } else { pl.amarillas++; e.amarillas++; }
    }
  });

  return [...players.values()].map(({ porPartido, ...p }) => ({
    ...p,
    partidos: games.map((g, gi) => ({
      round: g.round, rival: g.rival, gf: g.gf, gc: g.gc, match: g.match,
      ...(porPartido.get(gi) ?? { jugado: false, goles: 0, amarillas: 0, rojas: 0 }),
    })),
  }));
}
