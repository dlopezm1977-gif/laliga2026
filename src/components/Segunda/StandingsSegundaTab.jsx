import { useState } from 'react';
import { useStandingsSegunda } from '../../hooks/useStandingsSegunda';
import { useScorersSegunda } from '../../hooks/useScorersSegunda';
import { crestUrlSegunda } from '../../lib/crests';
import { ABBR } from '../../lib/segundaTeams';
import LoadingSpinner from '../LoadingSpinner';

function zoneClass(zones, position) {
  if (!zones?.length) return '';
  const zone = zones.find(z => position >= z.from && position <= z.to);
  if (!zone) return '';
  if (zone.key === 'promo')   return 'zone-hm-promo';
  if (zone.key === 'playoff') return 'zone-hm-playoff';
  if (zone.key === 'rel')     return 'zone-rel';
  return '';
}

function Form({ form }) {
  if (!form) return null;
  const chars = form.slice(-5).split('');
  return (
    <span className="hm-form">
      {chars.map((c, i) => (
        <span key={i} className={`hm-form-dot hm-form-${c.toLowerCase()}`}>{c}</span>
      ))}
    </span>
  );
}

function LigaView({ standings, zones }) {
  if (!standings.length) return (
    <div className="empty-state">
      <img src={`${import.meta.env.BASE_URL}icon-empty.png`} alt="" className="empty-icon" />
      <p>No hay datos de clasificación todavía.</p>
    </div>
  );

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
            <th className="col-hide">Forma</th>
          </tr>
        </thead>
        <tbody>
          {standings.map(team => {
            const cls = zoneClass(zones, team.position);
            return (
              <tr key={team.team_id} className={cls}>
                <td className="col-pos">{team.position}</td>
                <td className="col-team">
                  <img className="team-crest team-crest--sm" src={crestUrlSegunda(team.team_name)} alt="" />
                  <span className="team-full">{team.team_name}</span>
                  <span className="team-abbr">{ABBR[team.team_name] ?? team.team_name.slice(0, 3).toUpperCase()}</span>
                </td>
                <td>{team.played}</td>
                <td>{team.won}</td>
                <td>{team.drawn}</td>
                <td>{team.lost}</td>
                <td className="col-hide">{team.gf}</td>
                <td className="col-hide">{team.ga}</td>
                <td>{team.gd > 0 ? `+${team.gd}` : team.gd}</td>
                <td className="col-pts">{team.pts}</td>
                <td className="col-hide"><Form form={team.form} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="standings-legend hm-legend">
        <span className="legend-dot zone-hm-promo" />Ascenso directo
        <span className="legend-dot zone-hm-playoff" />Playoff
        <span className="legend-dot zone-rel" />Descenso
      </div>
    </div>
  );
}

function GoleadoresView({ leaders }) {
  const sorted = [...leaders].sort((a, b) =>
    (b.goals ?? b.value ?? 0) - (a.goals ?? a.value ?? 0) ||
    (b.assists ?? 0) - (a.assists ?? 0)
  );

  if (!sorted.length) return (
    <div className="empty-state">
      <img src={`${import.meta.env.BASE_URL}icon-empty.png`} alt="" className="empty-icon" />
      <p>No hay datos de goleadores todavía.</p>
    </div>
  );

  return (
    <div className="standings">
      <table className="standings-table scorers-table">
        <thead>
          <tr>
            <th className="col-pos">#</th>
            <th className="col-scorer-name">Jugador</th>
            <th className="col-scorer-team">Equipo</th>
            <th className="col-pts" title="Goles">G</th>
            <th title="Asistencias">A</th>
            <th className="col-hide">PJ</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((s, i) => (
            <tr key={s.player_id} className={i < 3 ? `scorer-top scorer-top${i + 1}` : ''}>
              <td className="col-pos">{i + 1}</td>
              <td className="col-scorer-name">{s.player_name}</td>
              <td className="col-scorer-team">
                <img className="team-crest team-crest--sm" src={crestUrlSegunda(s.team_name)} alt="" />
                <span className="team-full">{s.team_name}</span>
                <span className="team-abbr">{ABBR[s.team_name] ?? s.team_name.slice(0, 3).toUpperCase()}</span>
              </td>
              <td className="col-pts">{s.goals ?? s.value}</td>
              <td>{s.assists ?? '—'}</td>
              <td className="col-hide">{s.matches}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function StandingsSegundaTab() {
  const [view, setView] = useState('liga');
  const { standings, zones, loading: loadingStandings, error: errorStandings } = useStandingsSegunda();
  const { leaders, loading: loadingScorers, error: errorScorers } = useScorersSegunda();

  const loading = view === 'liga' ? loadingStandings : loadingScorers;
  const error   = view === 'liga' ? errorStandings   : errorScorers;

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
          <p style={{ color: 'var(--hm-accent)' }}>Error al cargar los datos.<br />Inténtalo de nuevo.</p>
        </div>
      )}

      {!loading && !error && view === 'liga'       && <LigaView standings={standings} zones={zones} />}
      {!loading && !error && view === 'goleadores'  && <GoleadoresView leaders={leaders} />}
    </div>
  );
}
