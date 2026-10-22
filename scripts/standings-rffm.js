// Cálculo de la clasificación RFFM a partir de los partidos jugados.
// Desempate entre equipos igualados a puntos (reglamento): resultados entre los implicados
// (puntos, diferencia de goles, goles a favor), repitiendo el criterio si solo se resuelve a un subgrupo;
// si sigue el empate: diferencia de goles total, goles a favor total y, por último, nombre.

function computeStandings(matchesByRound) {
  const played = Object.values(matchesByRound).flat();
  const teams = {};
  const ensure = (code, name, logo) =>
    (teams[code] ??= { code, name, logo, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 });

  for (const m of played) {
    const h = ensure(m.homeCode, m.homeTeam, m.homeLogo);
    const a = ensure(m.awayCode, m.awayTeam, m.awayLogo);
    if (m.homeScore === null || m.homeScore === undefined) continue;
    const hg = m.homeScore, ag = m.awayScore;
    h.pj++; h.gf += hg; h.gc += ag;
    a.pj++; a.gf += ag; a.gc += hg;
    if (hg > ag)        { h.pg++; h.pts += 3; a.pp++; }
    else if (hg === ag) { h.pe++; h.pts++; a.pe++; a.pts++; }
    else                { a.pg++; a.pts += 3; h.pp++; }
  }

  const results = played.filter(m => m.homeScore !== null && m.homeScore !== undefined);
  const withGd = Object.values(teams).map(t => ({ ...t, gd: t.gf - t.gc }));
  const overall = (a, b) => b.gd - a.gd || b.gf - a.gf || a.name.localeCompare(b.name);

  function breakTie(group) {
    if (group.length <= 1) return group;
    const codes = new Set(group.map(t => t.code));
    const mini = Object.fromEntries(group.map(t => [t.code, { pts: 0, gf: 0, gc: 0 }]));
    for (const m of results) {
      if (!codes.has(m.homeCode) || !codes.has(m.awayCode)) continue;
      const h = mini[m.homeCode], a = mini[m.awayCode];
      h.gf += m.homeScore; h.gc += m.awayScore;
      a.gf += m.awayScore; a.gc += m.homeScore;
      if (m.homeScore > m.awayScore)       h.pts += 3;
      else if (m.homeScore < m.awayScore)  a.pts += 3;
      else                                 { h.pts++; a.pts++; }
    }
    const key = t => { const s = mini[t.code]; return [s.pts, s.gf - s.gc, s.gf]; };
    const sorted = [...group].sort((a, b) => {
      const ka = key(a), kb = key(b);
      return kb[0] - ka[0] || kb[1] - ka[1] || kb[2] - ka[2];
    });

    const buckets = [];
    for (const t of sorted) {
      const last = buckets[buckets.length - 1];
      if (last && key(last[0]).join() === key(t).join()) last.push(t); else buckets.push([t]);
    }
    // Sin progreso: el enfrentamiento directo no separa a nadie → criterios generales
    if (buckets.length === 1) return [...group].sort(overall);
    return buckets.flatMap(b => breakTie(b));
  }

  const byPts = [...withGd].sort((a, b) => b.pts - a.pts);
  const out = [];
  for (let i = 0; i < byPts.length;) {
    let j = i;
    while (j < byPts.length && byPts[j].pts === byPts[i].pts) j++;
    out.push(...breakTie(byPts.slice(i, j)));
    i = j;
  }
  return out;
}

module.exports = { computeStandings };
