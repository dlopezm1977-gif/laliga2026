import { useState } from 'react';
import { useStandingsRffm } from '../../hooks/useStandingsRffm';
import { useScorersRffm }   from '../../hooks/useScorersRffm';
import { crestUrlRffm }        from '../../lib/crests';
import { shortName, abbr } from '../../lib/rffmTeams';
import LoadingSpinner from '../LoadingSpinner';

const FAVORITE_TEAM = 'S.A.D. OCIO Y DEPORTE CANAL A';

function LigaView({ standings }) {
  if (!standings.length) return (
    <div className="empty-state">
      <img src={`${import.meta.env.BASE_URL}icon-empty.png`} alt="" className="empty-icon" />
      <p>La temporada aún no ha comenzado.</p>
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
          </tr>
        </thead>
        <tbody>
          {standings.map((t, i) => (
            <tr key={t.code} className={t.name === FAVORITE_TEAM ? 'zone-rffm-fav' : ''}>
              <td className="col-pos">{i + 1}</td>
              <td className="col-team">
                <img className="team-crest team-crest--sm" src={crestUrlRffm(t.logo)} alt="" />
                <span className="team-full">{shortName(t.name)}</span>
                <span className="team-abbr">{abbr(t.name)}</span>
              </td>
              <td>{t.pj}</td>
              <td>{t.pg}</td>
              <td>{t.pe}</td>
              <td>{t.pp}</td>
              <td className="col-hide">{t.gf}</td>
              <td className="col-hide">{t.gc}</td>
              <td>{t.gd > 0 ? `+${t.gd}` : t.gd}</td>
              <td className="col-pts">{t.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GoleadoresView({ scorers }) {
  if (!scorers.length) return (
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
          </tr>
        </thead>
        <tbody>
          {scorers.map((s, i) => (
            <tr key={i} className={i < 3 ? `scorer-top scorer-top${i + 1}` : ''}>
              <td className="col-pos">{i + 1}</td>
              <td className="col-scorer-name">{s.nombre ?? s.jugador ?? s.player_name ?? s.player ?? '—'}</td>
              <td className="col-scorer-team">{s.equipo ?? s.team_name ?? s.team ?? '—'}</td>
              <td className="col-pts">{s.goles ?? s.goals ?? s.value ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function StandingsRffmTab() {
  const [view, setView] = useState('liga');
  const { standings, loading: lStand, error: eStand } = useStandingsRffm();
  const { scorers,   loading: lScore, error: eScore  } = useScorersRffm();

  const loading = view === 'liga' ? lStand : lScore;
  const error   = view === 'liga' ? eStand : eScore;

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
          <p style={{ color: 'var(--accent)' }}>Error al cargar los datos.</p>
        </div>
      )}

      {!loading && !error && view === 'liga'        && <LigaView standings={standings} />}
      {!loading && !error && view === 'goleadores'  && <GoleadoresView scorers={scorers} />}
    </div>
  );
}
