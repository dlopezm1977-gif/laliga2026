import { useMemo, useState } from 'react';
import { useMatches } from '../../hooks/useMatches';
import { useScorers } from '../../hooks/useScorers';
import { useAuth } from '../../contexts/AuthContext';
import { crestUrl } from '../../lib/crests';
import LoadingSpinner from '../LoadingSpinner';

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
  const { matchdayData, loading: loadingMatches, error: errorMatches } = useMatches();
  const { scorers, loading: loadingScorers, error: errorScorers } = useScorers();
  const { profile } = useAuth();
  const favoriteTeam = profile?.favoriteTeam || null;
  const standings = useMemo(() => buildStandings(matchdayData), [matchdayData]);

  const [view, setView] = useState('liga');

  const loading = view === 'liga' ? loadingMatches : loadingScorers;
  const error   = view === 'liga' ? errorMatches   : errorScorers;

  return (
    <div className="standings-wrap">
      <div className="standings-toggle">
        <button
          className={`toggle-btn${view === 'liga' ? ' active' : ''}`}
          onClick={() => setView('liga')}
        >Liga</button>
        <button
          className={`toggle-btn${view === 'goleadores' ? ' active' : ''}`}
          onClick={() => setView('goleadores')}
        >Goleadores</button>
      </div>

      {loading && <LoadingSpinner text={view === 'liga' ? 'Cargando clasificación…' : 'Cargando goleadores…'} />}

      {!loading && error && (
        <div className="empty-state">
          <img src={`${import.meta.env.BASE_URL}icon-error.png`} alt="" className="empty-icon" />
          <p style={{ color: 'var(--accent)' }}>Error al cargar los datos.<br />Inténtalo de nuevo.</p>
        </div>
      )}

      {!loading && !error && view === 'liga' && (
        standings.length === 0 ? (
          <div className="empty-state">
            <img src={`${import.meta.env.BASE_URL}icon-empty.png`} alt="" className="empty-icon" />
            <p>No hay datos de equipos todavía.</p>
          </div>
        ) : (
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
        )
      )}

      {!loading && !error && view === 'goleadores' && (
        scorers.length === 0 ? (
          <div className="empty-state">
            <img src={`${import.meta.env.BASE_URL}icon-empty.png`} alt="" className="empty-icon" />
            <p>No hay datos de goleadores todavía.</p>
          </div>
        ) : (
          <div className="standings">
            <table className="standings-table scorers-table">
              <thead>
                <tr>
                  <th className="col-pos">#</th>
                  <th className="col-scorer-name">Jugador</th>
                  <th className="col-scorer-team">Equipo</th>
                  <th className="col-pts">Goles</th>
                  <th className="col-hide">Asist</th>
                  <th className="col-hide">Pen</th>
                  <th className="col-hide">PJ</th>
                </tr>
              </thead>
              <tbody>
                {scorers.map((s, i) => (
                  <tr key={s.name + i}>
                    <td className="col-pos">{i + 1}</td>
                    <td className="col-scorer-name">{s.name}</td>
                    <td className="col-scorer-team">
                      <img className="team-crest team-crest--sm" src={s.crestUrl} alt="" />
                      <span className="team-full">{s.team}</span>
                      <span className="team-abbr">{s.teamAbbr}</span>
                    </td>
                    <td className="col-pts">{s.goals}</td>
                    <td className="col-hide">{s.assists}</td>
                    <td className="col-hide">{s.penalties}</td>
                    <td className="col-hide">{s.playedMatches}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
