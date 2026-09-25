import { useStandingsMunicipal } from '../../hooks/useStandingsMunicipal';
import { crestUrlMunicipal, crestUrlMunicipalFallback } from '../../lib/crests';
import LoadingSpinner from '../LoadingSpinner';

const FAVORITE_TEAM = 'ASTON BIRRA';

const ABBR = {
  'ASTON BIRRA':                                          'AST',
  'EL BRASIL':                                            'BRA',
  'Pisatechos FS':                                        'PIS',
  'Laguneta':                                             'LAG',
  'Bakers':                                               'BAK',
  'SCHALKE TEMETO F.S.':                                  'SCH',
  'S.I.D.A Sociedad Independiente Deportiva Anónima':     'SID',
  'Swölims XXII':                                         'SWO',
  'LOS TITIS':                                            'TIT',
  'ACUÉTATE FC':                                          'ACU',
  'PEÑA ATLÉTICA TETUÁN':                                 'PAT',
  'La Torlenta':                                          'TOR',
};

function LigaView({ standings }) {
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
          </tr>
        </thead>
        <tbody>
          {standings.map(t => (
            <tr key={t.name} className={t.name === FAVORITE_TEAM ? 'zone-rffm-fav' : ''}>
              <td className="col-pos">{t.position}</td>
              <td className="col-team">
                <img className="team-crest team-crest--sm" src={crestUrlMunicipal(t.name)} alt="" onError={e => { e.target.onerror = null; e.target.src = crestUrlMunicipalFallback(t.name); }} />
                <span className="team-full">{t.name}</span>
                <span className="team-abbr">{ABBR[t.name] ?? t.name.slice(0, 3).toUpperCase()}</span>
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

export default function StandingsMunicipalTab() {
  const { standings, loading, error } = useStandingsMunicipal();

  return (
    <div className="standings-wrap">
      {loading && <LoadingSpinner text="Cargando clasificación…" />}
      {!loading && error && (
        <div className="empty-state">
          <img src={`${import.meta.env.BASE_URL}icon-error.png`} alt="" className="empty-icon" />
          <p style={{ color: 'var(--accent)' }}>Error al cargar los datos.<br />Inténtalo de nuevo.</p>
        </div>
      )}
      {!loading && !error && <LigaView standings={standings} />}
    </div>
  );
}
