import { useMemo } from 'react';
import { useMatches } from '../../hooks/useMatches';
import { useAuth } from '../../contexts/AuthContext';
import { crestUrl } from '../../lib/crests';

const ABBR = {
  'Real Madrid':   'RMA', 'Barcelona':     'BAR', 'Atlético':      'ATM',
  'Sevilla':       'SEV', 'Betis':         'BET', 'Real Sociedad': 'RSO',
  'Villarreal':    'VIL', 'Athletic':      'ATH', 'Valencia':      'VAL',
  'Osasuna':       'OSA', 'Celta':         'CEL', 'Getafe':        'GET',
  'Rayo':          'RAY', 'Alavés':        'ALA', 'Espanyol':      'ESP',
  'Racing':        'RAC', 'Levante':       'LEV', 'Deportivo':     'DEP',
  'Elche':         'ELC', 'Málaga':        'MAL',
};

function buildStandings(matchdayData) {
  const table = {};

  const ensure = name => {
    if (!table[name]) table[name] = { name, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0 };
  };

  // Seed all teams regardless of whether they've played
  for (const matches of Object.values(matchdayData)) {
    for (const m of matches) {
      ensure(m.homeTeam);
      ensure(m.awayTeam);
    }
  }

  for (const matches of Object.values(matchdayData)) {
    for (const m of matches) {
      const counted = m.status === 'FINISHED' || m.status === 'IN_PLAY' || m.status === 'PAUSED';
      if (!counted || m.homeScore === null || m.awayScore === null) continue;
      const h = table[m.homeTeam];
      const a = table[m.awayTeam];
      h.pj++; a.pj++;
      h.gf += m.homeScore; h.gc += m.awayScore;
      a.gf += m.awayScore; a.gc += m.homeScore;
      if (m.homeScore > m.awayScore)      { h.g++; a.p++; }
      else if (m.homeScore < m.awayScore) { a.g++; h.p++; }
      else                                { h.e++; a.e++; }
    }
  }

  return Object.values(table)
    .map(t => ({ ...t, dg: t.gf - t.gc, pts: t.g * 3 + t.e }))
    .sort((a, b) =>
      b.pts - a.pts || b.dg - a.dg || b.gf - a.gf || a.name.localeCompare(b.name)
    );
}

function zoneClass(pos) {
  if (pos <= 4) return 'zone-ucl';
  if (pos === 5) return 'zone-uel';
  if (pos === 6) return 'zone-uecl';
  if (pos >= 18) return 'zone-rel';
  return '';
}

export default function StandingsTab() {
  const { matchdayData, loading, error } = useMatches();
  const { profile } = useAuth();
  const favoriteTeam = profile?.favoriteTeam || null;
  const standings = useMemo(() => buildStandings(matchdayData), [matchdayData]);

  if (loading) return <div className="loading">Cargando clasificación…</div>;
  if (error)   return <div className="loading" style={{ color: 'var(--accent)' }}>Error: {error}</div>;
  if (!standings.length) return <div className="loading">No hay datos de equipos todavía.</div>;

  return (
    <div className="standings">
      <table className="standings-table">
        <thead>
          <tr>
            <th className="col-pos">#</th>
            <th className="col-team">Equipo</th>
            <th>PJ</th>
            <th>G</th>
            <th>E</th>
            <th>P</th>
            <th className="col-hide">GF</th>
            <th className="col-hide">GC</th>
            <th>DG</th>
            <th className="col-pts">Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((team, i) => {
            const pos = i + 1;
            const isFav = team.name === favoriteTeam;
            return (
              <tr key={team.name} className={[zoneClass(pos), isFav ? 'row-favorite' : ''].filter(Boolean).join(' ')}>
                <td className="col-pos">{pos}</td>
                <td className="col-team">
                  <img className="team-crest team-crest--sm" src={crestUrl(team.name)} alt="" />
                  <span className="team-full">{team.name}</span>
                  <span className="team-abbr">{ABBR[team.name] ?? team.name.slice(0, 3).toUpperCase()}</span>
                </td>
                <td>{team.pj}</td>
                <td>{team.g}</td>
                <td>{team.e}</td>
                <td>{team.p}</td>
                <td className="col-hide">{team.gf}</td>
                <td className="col-hide">{team.gc}</td>
                <td>{team.dg > 0 ? `+${team.dg}` : team.dg}</td>
                <td className="col-pts">{team.pts}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="standings-legend">
        <span className="legend-dot zone-ucl" />UCL
        <span className="legend-dot zone-uel" />UEL
        <span className="legend-dot zone-uecl" />UECL
        <span className="legend-dot zone-rel" />Descenso
      </div>
    </div>
  );
}
