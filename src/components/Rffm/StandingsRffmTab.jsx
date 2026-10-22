import { useState } from 'react';
import { useStandingsRffm } from '../../hooks/useStandingsRffm';
import { useScorersRffm }   from '../../hooks/useScorersRffm';
import { crestUrlRffm }        from '../../lib/crests';
import { shortName, abbr } from '../../lib/rffmTeams';
import LoadingSpinner from '../LoadingSpinner';
import { useMatchesRffm } from '../../hooks/useMatchesRffm';
import { rffmSeasonConfig } from '../../lib/rffmSeasons';

function rowClass(pos, total, isFav, cfg) {
  const zones = [];
  if (pos <= cfg.promoSpots)                                zones.push('zone-hm-promo');
  else if (cfg.maybePromoSpots && pos <= cfg.promoSpots + cfg.maybePromoSpots) zones.push('zone-hm-playoff');
  if (cfg.relSpots && pos > total - cfg.relSpots)           zones.push('zone-rel');
  if (isFav)                                zones.push('zone-rffm-fav');
  return zones.join(' ');
}

function LigaView({ standings, cfg }) {
  if (!standings.length) return (
    <div className="empty-state">
      <img src={`${import.meta.env.BASE_URL}icon-empty.png`} alt="" className="empty-icon" />
      <p>La temporada aún no ha comenzado.</p>
    </div>
  );

  const total = standings.length;

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
            <tr key={t.code} className={rowClass(i + 1, total, t.name === cfg.favorite, cfg)}>
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
      <div className="standings-legend">
        {cfg.promoSpots > 0 && <><span className="legend-dot zone-hm-promo" />Ascenso</>}
        {cfg.maybePromoSpots > 0 && <><span className="legend-dot zone-hm-playoff" />Ascenso si es de los mejores sextos</>}
        {cfg.relSpots   > 0 &&<><span className="legend-dot zone-rel" />Descenso</>}
      </div>
    </div>
  );
}

// El escudo descargado puede tener otra extensión que la de la API de goleadores,
// así que se prefiere el de la clasificación (mismo codigo de equipo).
function scorerCrest(s, logoByCode) {
  const fromStandings = logoByCode[String(s.codigo_equipo)];
  if (fromStandings) return crestUrlRffm(fromStandings);
  if (!s.escudo_equipo || !s.codigo_equipo) return crestUrlRffm(null);
  const ext = s.escudo_equipo.split('.').pop().toLowerCase() || 'jpg';
  return crestUrlRffm(`crests-rffm/${s.codigo_equipo}.${ext}`);
}

function GoleadoresView({ scorers, standings }) {
  const logoByCode = Object.fromEntries(standings.filter(t => t.logo).map(t => [String(t.code), t.logo]));
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
              <td className="col-scorer-name">{s.jugador ?? '—'}</td>
              <td className="col-scorer-team">
                <img className="team-crest team-crest--sm" src={scorerCrest(s, logoByCode)} alt="" />
                <span className="team-full">{shortName(s.nombre_equipo ?? '')}</span>
                <span className="team-abbr">{abbr(s.nombre_equipo ?? '')}</span>
              </td>
              <td className="col-pts">{s.goles ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function StandingsRffmTab({ season = null }) {
  const [view, setView] = useState('liga');
  const { currentSeason } = useMatchesRffm(season);
  const cfg = rffmSeasonConfig(season ?? currentSeason);
  const { standings, loading: lStand, error: eStand } = useStandingsRffm(season);
  const { scorers,   loading: lScore, error: eScore  } = useScorersRffm(season);

  const loading = view === 'liga' ? lStand : (lScore || lStand);
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

      {!loading && !error && view === 'liga'        && <LigaView standings={standings} cfg={cfg} />}
      {!loading && !error && view === 'goleadores'  && <GoleadoresView scorers={scorers} standings={standings} />}
    </div>
  );
}
