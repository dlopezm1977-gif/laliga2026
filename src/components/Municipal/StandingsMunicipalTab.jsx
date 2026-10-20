import { useState, Fragment } from 'react';
import { useStandingsMunicipal } from '../../hooks/useStandingsMunicipal';
import { useStatsMunicipal } from '../../hooks/useStatsMunicipal';
import { crestUrlMunicipal, crestUrlMunicipalFallback } from '../../lib/crests';
import LoadingSpinner from '../LoadingSpinner';

const FAVORITE_TEAM = 'ASTON BIRRA';

const ABBR = {
  'ASTON BIRRA':                                          'AST',
  'EL BRASIL':                                            'BRA',
  'Bakers':                                               'BAK',
  'SCHALKE TEMETO F.S.':                                  'SCH',
  'Swölims XXII':                                         'SWO',
  'Swölims XXIII':                                        'SWO',
  'LOS TITIS':                                            'TIT',
  'Los Titis':                                            'TIT',
  'Jartos fc':                                            'JAR',
  'U.D. Mamayema':                                        'MAM',
  'VELERO':                                               'VEL',
  'El Birra':                                             'BIR',
  'LEGGENDE LICEO':                                       'LEG',
  'Pisatechos FS':                                        'PIS',
  'Laguneta':                                             'LAG',
  'S.I.D.A Sociedad Independiente Deportiva Anónima':     'SID',
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

const SORTS = {
  goles:     (a, b) => b.goles - a.goles || a.pj - b.pj,
  pj:        (a, b) => b.pj - a.pj,
  amarillas: (a, b) => b.amarillas - a.amarillas || b.rojas - a.rojas,
  rojas:     (a, b) => b.rojas - a.rojas || b.amarillas - a.amarillas,
};

function EstadisticasView({ stats }) {
  const [sort, setSort] = useState('pj');
  const [open, setOpen] = useState(null);
  const rows = [...stats].sort((a, b) => SORTS[sort](a, b) || a.nombre.localeCompare(b.nombre));

  if (!rows.length) return (
    <div className="empty-state">
      <img src={`${import.meta.env.BASE_URL}icon-empty.png`} alt="" className="empty-icon" />
      <p>No hay actas registradas todavía.</p>
    </div>
  );

  const th = (key, text, title) => (
    <th
      className={`col-pts${sort === key ? ' sorted' : ''}`}
      title={title}
      style={{ cursor: 'pointer', ...(sort === key && { color: 'var(--accent)' }) }}
      onClick={() => setSort(key)}
    >{text}</th>
  );

  return (
    <div className="standings">
      <table className="standings-table scorers-table">
        <thead>
          <tr>
            <th className="col-pos">#</th>
            <th className="col-scorer-name">Jugador</th>
            {th('pj', 'PJ', 'Partidos jugados')}
            {th('goles', 'G', 'Goles')}
            {th('amarillas', '🟨', 'Tarjetas amarillas')}
            {th('rojas', '🟥', 'Tarjetas rojas')}
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => (
            <Fragment key={p.nombre}>
              <tr style={{ cursor: 'pointer' }} onClick={() => setOpen(open === p.nombre ? null : p.nombre)}>
                <td className="col-pos">{i + 1}</td>
                <td className="col-scorer-name">{open === p.nombre ? '▾' : '▸'} {p.nombre}</td>
                <td className="col-pts">{p.pj}</td>
                <td className="col-pts">{p.goles}</td>
                <td className="col-pts">{p.amarillas}</td>
                <td className="col-pts">{p.rojas}</td>
              </tr>
              {open === p.nombre && (
                <tr>
                  <td colSpan={6} style={{ padding: '4px 8px 10px', maxWidth: 0, overflow: 'hidden' }}>
                    {(() => {
                      // Ancho fijo para los iconos, según el partido con más eventos de este jugador
                      const maxIcons = Math.max(1, ...p.partidos.map(g => g.goles + g.amarillas + g.rojas));
                      const iconsW = maxIcons * 1.35;
                      return p.partidos.map(g => {
                      const won = g.gf != null && g.gc != null && g.gf > g.gc;
                      return (
                      <div key={g.round} style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '3px 6px', fontSize: '0.85rem',
                        opacity: g.jugado ? 1 : 0.55,
                        ...(won && { background: 'color-mix(in srgb, var(--green) 8%, transparent)', borderLeft: '2px solid color-mix(in srgb, var(--green) 55%, transparent)', borderRadius: 4 }),
                      }}>
                        <span style={{ width: 28, fontWeight: 600 }}>J{g.round}</span>
                        <img className="team-crest team-crest--sm" style={{ flexShrink: 0 }} src={crestUrlMunicipal(g.rival)} alt="" onError={e => { e.target.onerror = null; e.target.src = crestUrlMunicipalFallback(g.rival); }} />
                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>
                          <span className="team-full">{g.rival}</span>
                          <span className="team-abbr">{ABBR[g.rival] ?? g.rival.slice(0, 3).toUpperCase()}</span>
                        </span>
                        <span style={{ flexShrink: 0, width: '3.4em', textAlign: 'right', opacity: 0.7, whiteSpace: 'nowrap' }}>({g.gf ?? '–'}-{g.gc ?? '–'})</span>
                        <span style={{ flexShrink: 0, width: '1.4em', textAlign: 'center' }} title={g.jugado ? 'Jugó' : 'No jugó'}>{g.jugado ? '✅' : '❌'}</span>
                        <span style={{ flexShrink: 0, width: `${iconsW}em`, textAlign: 'left', whiteSpace: 'nowrap' }}>
                          {'⚽'.repeat(g.goles)}{'🟨'.repeat(g.amarillas)}{'🟥'.repeat(g.rojas)}
                        </span>
                      </div>
                      );
                      });
                    })()}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function StandingsMunicipalTab({ season = null }) {
  const [view, setView] = useState('liga');
  const { standings, loading: lStand, error: eStand } = useStandingsMunicipal(season);
  const { stats, loading: lStats, error: eStats }     = useStatsMunicipal(season);

  const loading = view === 'liga' ? lStand : lStats;
  const error   = view === 'liga' ? eStand : eStats;

  return (
    <div className="standings-wrap">
      <div className="standings-toggle">
        <button
          className={`toggle-btn${view === 'liga' ? ' active' : ''}`}
          onClick={() => setView('liga')}
        >Liga</button>
        <button
          className={`toggle-btn${view === 'estadisticas' ? ' active' : ''}`}
          onClick={() => setView('estadisticas')}
        >Estadísticas</button>
      </div>

      {loading && <LoadingSpinner text={view === 'liga' ? 'Cargando clasificación…' : 'Cargando estadísticas…'} />}
      {!loading && error && (
        <div className="empty-state">
          <img src={`${import.meta.env.BASE_URL}icon-error.png`} alt="" className="empty-icon" />
          <p style={{ color: 'var(--accent)' }}>Error al cargar los datos.<br />Inténtalo de nuevo.</p>
        </div>
      )}
      {!loading && !error && view === 'liga'         && <LigaView standings={standings} />}
      {!loading && !error && view === 'estadisticas' && <EstadisticasView stats={stats} />}
    </div>
  );
}
