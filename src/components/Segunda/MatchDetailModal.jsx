import { useState, useEffect } from 'react';
import { crestUrlSegunda } from '../../lib/crests';
import { abbr, canonicalize } from '../../lib/segundaTeams';
import { useMatchTabData } from '../../hooks/useMatchTabData';
import LoadingSpinner from '../LoadingSpinner';

function formatDateLong(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid',
  });
}

function formatDateShort(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Madrid',
  });
}

function WeatherIcon({ code }) {
  if (code == null) return null;
  if (code <= 3)  return '☀️';
  if (code <= 9)  return '🌤️';
  if (code <= 19) return '🌫️';
  if (code <= 29) return '🌧️';
  if (code <= 39) return '🌨️';
  if (code <= 49) return '🌩️';
  if (code <= 59) return '🌧️';
  if (code <= 69) return '❄️';
  return '🌦️';
}

function H2HTeam({ name, align, dim }) {
  const canonical = canonicalize(name);
  return (
    <span className={`h2h-team h2h-team--${align}${dim ? ' h2h-team--dim' : ''}`}>
      <img className="team-crest team-crest--sm" src={crestUrlSegunda(canonical)} alt="" />
      <span>{abbr(name)}</span>
    </span>
  );
}

function H2HRow({ m }) {
  const [hs, as] = m.score.split('-').map(Number);
  const draw = hs === as;
  return (
    <tr>
      <td className="h2h-date">{formatDateShort(m.date)}</td>
      <td className="h2h-home"><H2HTeam name={m.home} align="home" dim={!draw && hs < as} /></td>
      <td className={`h2h-score${draw ? ' h2h-score--draw' : ''}`}>{m.score}</td>
      <td className="h2h-away"><H2HTeam name={m.away} align="away" dim={!draw && as < hs} /></td>
    </tr>
  );
}

/* ── Stats tab ─────────────────────────────────────────────── */

function StatRow({ label, home, away, pct = false, decimals = 0 }) {
  const h = home ?? 0;
  const a = away ?? 0;
  const total = h + a;
  const homeFill = total > 0 ? (h / total) * 100 : 50;
  const fmt = v => pct ? `${v}%` : (decimals > 0 ? Number(v).toFixed(decimals) : v);
  return (
    <div className="md-stat-row">
      <span className="md-stat-val">{fmt(h)}</span>
      <div className="md-stat-center">
        <div className="md-stat-bar">
          <div className="md-stat-fill" style={{ width: `${homeFill}%` }} />
        </div>
        <span className="md-stat-label">{label}</span>
      </div>
      <span className="md-stat-val md-stat-val--away">{fmt(a)}</span>
    </div>
  );
}

function StatsTab({ data, loading, error }) {
  if (loading) return <LoadingSpinner text="Cargando estadísticas…" />;
  if (error)   return <p className="md-tab-error">Error al cargar estadísticas.</p>;
  if (!data)   return null;

  const h = data.stats?.home;
  const a = data.stats?.away;
  if (!h || !a) return <p className="md-tab-error">Sin datos disponibles.</p>;

  return (
    <div className="md-stats">
      <StatRow label="⏱ Posesión"      home={h.ball_possession} away={a.ball_possession} pct />
      <StatRow label="🎯 Tiros totales" home={h.total_shots}     away={a.total_shots} />
      <StatRow label="🥅 A portería"    home={h.shots_on_target} away={a.shots_on_target} />
      <StatRow label="🚩 Córners"       home={h.corner_kicks}    away={a.corner_kicks} />
      <StatRow label="✋ Faltas"         home={h.fouls}           away={a.fouls} />
      <StatRow label={<><span className="md-card md-card--yellow" /> T. Amarillas</>} home={h.yellow_cards}   away={a.yellow_cards} />
      <StatRow label={<><span className="md-card md-card--red" /> T. Rojas</>}      home={h.red_cards ?? 0} away={a.red_cards ?? 0} />
      {h.xg?.actual != null && (
        <StatRow label="📊 xG" home={h.xg.actual} away={a.xg?.actual ?? 0} decimals={2} />
      )}
    </div>
  );
}

/* ── Incidents tab ─────────────────────────────────────────── */

function incHome(inc) {
  return inc.is_home ?? (inc.team === 'home');
}
function fmtMin(inc) {
  const m = inc.minute ?? inc.min ?? '?';
  const a = inc.added_time ?? inc.added;
  return a ? `${m}+${a}'` : `${m}'`;
}
function byMinute(a, b) {
  const ma = (a.minute ?? a.min ?? 0) + (a.added_time ?? a.added ?? 0) / 100;
  const mb = (b.minute ?? b.min ?? 0) + (b.added_time ?? b.added ?? 0) / 100;
  return ma - mb;
}

function GoalItem({ inc }) {
  return (
    <div className="md-inc-item">
      <span className="md-inc-min">{fmtMin(inc)}</span>
      <span className="md-inc-player"> {inc.player ?? '—'}</span>
      {inc.type === 'own_goal' && <span className="md-inc-note"> (PP)</span>}
      {inc.assist && <div className="md-inc-assist">Asist: {inc.assist}</div>}
    </div>
  );
}

function CardItem({ inc }) {
  const cls = inc.card_type === 'red' ? 'red' : 'yellow';
  return (
    <div className="md-inc-item">
      <span className="md-inc-min">{fmtMin(inc)}</span>
      <span className={`md-card md-card--${cls}`} style={{ margin: '0 .2rem' }} />
      <span className="md-inc-player">{inc.player ?? '—'}</span>
    </div>
  );
}

function SubItem({ inc }) {
  return (
    <div className="md-inc-item">
      <span className="md-inc-min">{fmtMin(inc)}</span>
      <div className="md-inc-sub-wrap">
        {inc.player_in  && <div><span className="md-inc-arrow md-inc-arrow--in">↑</span> {inc.player_in}</div>}
        {inc.player_out && <div><span className="md-inc-arrow md-inc-arrow--out">↓</span> {inc.player_out}</div>}
        {!inc.player_in && !inc.player_out && <span>{inc.player ?? '—'}</span>}
      </div>
    </div>
  );
}

function IncSection({ label, homeItems, awayItems, renderItem }) {
  return (
    <div className="md-inc-section">
      <div className="md-inc-section-title">{label}</div>
      <div className="md-inc-cols">
        <div className="md-inc-col">
          {homeItems.map((inc, i) => <div key={i}>{renderItem(inc)}</div>)}
        </div>
        <div className="md-inc-col md-inc-col--away">
          {awayItems.map((inc, i) => <div key={i}>{renderItem(inc)}</div>)}
        </div>
      </div>
    </div>
  );
}

function IncidentsTab({ data, loading, error, detail }) {
  if (loading) return <LoadingSpinner text="Cargando incidencias…" />;
  if (error)   return <p className="md-tab-error">Error al cargar incidencias.</p>;
  if (!data)   return null;

  const items = Array.isArray(data) ? data : (data.incidents ?? []);

  const isFinished = detail?.status === 'finished';
  const isLive     = ['live', 'in_progress', 'halftime'].includes(detail?.status);
  const statusLabel = isFinished ? 'Final'
    : detail?.status === 'halftime' ? 'Descanso'
    : isLive ? `${detail.current_minute}'`
    : null;

  const goals = items.filter(i => i.type === 'goal' || i.type === 'own_goal');
  const cards = items.filter(i => i.type === 'card');
  const subs  = items.filter(i => i.type === 'substitution');

  const split = arr => ({
    home: arr.filter(i =>  incHome(i)).sort(byMinute),
    away: arr.filter(i => !incHome(i)).sort(byMinute),
  });

  const g = split(goals), c = split(cards), s = split(subs);
  const hasAny = goals.length || cards.length || subs.length;

  return (
    <div className="md-incidents-v2">
      {statusLabel && (
        <div className="md-inc-status">
          {isFinished ? '⏹' : '⏱'} {statusLabel}
        </div>
      )}

      <div className="md-inc-col-headers">
        <span>{detail?.home_team ?? 'Local'}</span>
        <span>{detail?.away_team ?? 'Visitante'}</span>
      </div>

      {!hasAny && (
        <p style={{ color: 'var(--muted)', textAlign: 'center', fontSize: '.82rem', padding: '.5rem 0' }}>
          Sin incidencias registradas.
        </p>
      )}

      <IncSection label={<>⚽ Goles</>}   homeItems={g.home} awayItems={g.away} renderItem={inc => <GoalItem inc={inc} />} />
      <IncSection label={<><span className="md-card md-card--yellow" style={{marginRight:2}}/><span className="md-card md-card--red" style={{marginRight:4}}/>Tarjetas</>} homeItems={c.home} awayItems={c.away} renderItem={inc => <CardItem inc={inc} />} />
      <IncSection label={<>🔄 Cambios</>} homeItems={s.home} awayItems={s.away} renderItem={inc => <SubItem  inc={inc} />} />
    </div>
  );
}

/* ── Lineups tab ───────────────────────────────────────────── */

const POS_LABEL = { G: 'POR', D: 'DEF', M: 'MED', F: 'DEL' };
const POS_ORDER = { G: 0, D: 1, M: 2, F: 3 };
const POS_COLOR = { G: '#1a8f4e', D: '#2a6dd9', M: '#c8a000', F: '#d94040' };

function buildPitchRows(players, formation) {
  const gk      = players.filter(p => p.position === 'G');
  const outfield = players.filter(p => p.position !== 'G');
  const rowNums  = formation?.split('-').map(Number).filter(n => n > 0);

  let outfieldRows;
  if (rowNums?.length) {
    let idx = 0;
    outfieldRows = rowNums.map(n => { const r = outfield.slice(idx, idx + n); idx += n; return r; });
  } else {
    const byPos = {};
    outfield.forEach(p => { (byPos[p.position] = byPos[p.position] ?? []).push(p); });
    outfieldRows = ['D', 'M', 'F'].map(pos => byPos[pos] ?? []).filter(r => r.length);
  }

  const Y_GK  = 54;
  const Y_TOP = 12;
  const Y_BOT = 42;
  const step  = outfieldRows.length > 1 ? (Y_BOT - Y_TOP) / (outfieldRows.length - 1) : 0;

  return [
    { players: gk, y: Y_GK },
    ...outfieldRows.map((rowPlayers, i) => ({ players: rowPlayers, y: Y_BOT - i * step })),
  ];
}

function FormationPitch({ players, formation }) {
  const rows = buildPitchRows(players, formation);

  const dots = rows.flatMap(({ players: rowPlayers, y }) =>
    rowPlayers.map((player, i, arr) => ({
      player,
      x: (80 / (arr.length + 1)) * (i + 1),
      y,
      color: POS_COLOR[player.position] ?? '#888',
    }))
  );

  return (
    <svg viewBox="0 0 80 62" width="100%" style={{ display: 'block', borderRadius: 5, marginBottom: '.5rem' }}>
      <rect x="0" y="0" width="80" height="62" fill="#2a6e2a" rx="3" />
      {[0, 1, 2, 3].map(i => (
        <rect key={i} x="0" y={i * 15.5} width="80" height="7.75" fill="rgba(0,0,0,0.07)" />
      ))}
      <rect x="1.5" y="1.5" width="77" height="59" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="0.8" />
      <rect x="22" y="1.5" width="36" height="16" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.7" />
      <rect x="30" y="1.5" width="20" height="7" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.6" />
      <rect x="33" y="0" width="14" height="1.5" fill="rgba(255,255,255,0.55)" />
      <circle cx="40" cy="13" r="0.8" fill="rgba(255,255,255,0.5)" />
      <line x1="1.5" y1="60.5" x2="78.5" y2="60.5" stroke="rgba(255,255,255,0.3)" strokeWidth="0.7" />
      {dots.map(({ x, y, color, player }, i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="4.5" fill={color} />
          <text x={x} y={y} textAnchor="middle" dominantBaseline="central"
            fontSize="3.2" fontWeight="700" fill="white" fontFamily="system-ui,sans-serif">
            {player.jersey_number ?? ''}
          </text>
        </g>
      ))}
    </svg>
  );
}

function PlayerRow({ p, dimmed }) {
  const pos = p.position;
  return (
    <div className="md-lineup-player" style={dimmed ? { opacity: .65 } : undefined}>
      <span className="md-lineup-num">{p.jersey_number ?? p.number ?? ''}</span>
      <span className="md-lineup-name">{p.short_name ?? p.name ?? '—'}{p.captain ? ' ©' : ''}</span>
      {pos && (
        <span className={`md-lineup-pos md-lineup-pos--${pos.toLowerCase()}`}>
          {POS_LABEL[pos] ?? pos}
        </span>
      )}
    </div>
  );
}

function LineupTeam({ teamData, label }) {
  if (!teamData) return (
    <div className="md-lineup-col">
      <div className="md-lineup-header">{label}</div>
      <p style={{ fontSize: '.78rem', color: 'var(--muted)' }}>No disponible</p>
    </div>
  );

  const starting = teamData.players ?? [];
  const bench    = [...(teamData.substitutes ?? [])].sort(
    (a, b) => (POS_ORDER[a.position] ?? 9) - (POS_ORDER[b.position] ?? 9)
  );

  return (
    <div className="md-lineup-col">
      <div className="md-lineup-header">{label}</div>
      {teamData.formation && <div className="md-lineup-formation">{teamData.formation}</div>}
      <FormationPitch players={starting} formation={teamData.formation} />
      {starting.map((p, i) => <PlayerRow key={i} p={p} />)}
      {bench.length > 0 && (
        <>
          <div className="md-lineup-divider">Suplentes</div>
          {bench.map((p, i) => <PlayerRow key={i} p={p} dimmed />)}
        </>
      )}
    </div>
  );
}

const LINEUP_STATUS = {
  confirmed:   { label: 'Alineación confirmada',   cls: 'confirmed' },
  expected:    { label: 'Alineación provisional',  cls: 'provisional' },
  predicted:   { label: 'Alineación provisional',  cls: 'provisional' },
  provisional: { label: 'Alineación provisional',  cls: 'provisional' },
};

function LineupsTab({ data, loading, error }) {
  if (loading) return <LoadingSpinner text="Cargando alineaciones…" />;
  if (error)   return <p className="md-tab-error">Error al cargar alineaciones.</p>;
  if (!data)   return null;

  const status = data.lineup_status ? (LINEUP_STATUS[data.lineup_status] ?? { label: data.lineup_status, cls: 'provisional' }) : null;

  return (
    <>
      {status && (
        <div className={`md-lineup-status md-lineup-status--${status.cls}`}>
          {status.cls === 'confirmed' ? '✓' : '○'} {status.label}
        </div>
      )}
      <div className="md-lineups">
        <LineupTeam teamData={data.lineups?.home} label={data.lineups?.home?.team_name ?? 'Local'} />
        <LineupTeam teamData={data.lineups?.away} label={data.lineups?.away?.team_name ?? 'Visitante'} />
      </div>
    </>
  );
}

/* ── Main modal ────────────────────────────────────────────── */

const TABS = [
  { id: 'resumen',      label: 'Resumen' },
  { id: 'stats',        label: 'Estadísticas' },
  { id: 'alineaciones', label: 'Alineación' },
  { id: 'incidencias',  label: 'Incidencias' },
];

export default function MatchDetailModal({ detail, loading, error, onClose, matchId }) {
  const [activeTab, setActiveTab] = useState('resumen');
  const { stats, lineups, incidents } = useMatchTabData();

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const isFinished = detail?.status === 'finished';
  const isLive     = ['live', 'in_progress', 'halftime'].includes(detail?.status);
  const matchStart = detail?.event_date ? new Date(detail.event_date) : null;
  const tabsEnabled = isFinished || isLive ||
    (matchStart != null && (matchStart.getTime() - Date.now()) <= 24 * 60 * 60 * 1000);

  const h2h       = detail?.head_to_head;
  const highlight = detail?.highlights?.[0];
  const weather   = detail?.weather;
  const hasHT     = detail?.home_score_ht != null;

  function selectTab(tab) {
    if (!tabsEnabled && tab !== 'resumen') return;
    setActiveTab(tab);
    if (matchId == null) return;
    if (tab === 'stats')        stats.load(matchId);
    if (tab === 'alineaciones') lineups.load(matchId);
    if (tab === 'incidencias')  incidents.load(matchId);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel match-detail-panel" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>

        {loading && <LoadingSpinner text="Cargando detalles…" />}

        {error && !loading && (
          <p style={{ color: 'var(--hm-accent)', textAlign: 'center', padding: '2rem' }}>
            Error al cargar los detalles.
          </p>
        )}

        {detail && !loading && (
          <>
            {/* Cabecera: equipos + resultado */}
            <div className="md-header">
              <div className="md-team">
                <img className="md-crest" src={crestUrlSegunda(detail.home_team)} alt="" />
                <span className="md-team-name">{detail.home_team}</span>
              </div>

              <div className="md-score-block">
                {(isFinished || isLive) ? (
                  <>
                    <div className="md-score-main">
                      <span>{detail.home_score}</span>
                      <span className="md-sep">-</span>
                      <span>{detail.away_score}</span>
                    </div>
                    {hasHT && (
                      <div className="md-score-ht">
                        ({detail.home_score_ht} - {detail.away_score_ht}) HT
                      </div>
                    )}
                    <div className="md-status">
                      {isFinished ? 'Final' : detail.status === 'halftime' ? 'Descanso' : `${detail.current_minute}'`}
                    </div>
                  </>
                ) : (
                  <div className="md-score-main md-vs">VS</div>
                )}
              </div>

              <div className="md-team">
                <img className="md-crest" src={crestUrlSegunda(detail.away_team)} alt="" />
                <span className="md-team-name">{detail.away_team}</span>
              </div>
            </div>

            {/* Fecha + clima */}
            <div className="md-meta">
              <span>{formatDateLong(detail.event_date)}</span>
              {weather?.temperature_c != null && (
                <span className="md-weather">
                  <WeatherIcon code={weather.code} /> {Math.round(weather.temperature_c)}°C
                  {weather.wind_speed != null && ` · ${Math.round(weather.wind_speed)} km/h`}
                </span>
              )}
            </div>

            {/* Tabs */}
            <div className="md-tabs">
              {TABS.map(t => (
                <button
                  key={t.id}
                  className={`md-tab-btn${activeTab === t.id ? ' active' : ''}`}
                  disabled={!tabsEnabled && t.id !== 'resumen'}
                  title={!tabsEnabled && t.id !== 'resumen' ? 'Disponible 24h antes del partido' : undefined}
                  onClick={() => selectTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {activeTab === 'resumen' && (
              <>
                {highlight && (
                  <div className="md-section">
                    <h4 className="md-section-title">Highlights</h4>
                    <a
                      href={highlight.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="md-highlight-link"
                    >
                      {highlight.thumbnail && (
                        <img className="md-thumbnail" src={highlight.thumbnail} alt="Highlights" />
                      )}
                      <span className="md-highlight-label">▶ Ver highlights completos</span>
                    </a>
                  </div>
                )}

                {h2h && h2h.total_matches > 0 && (
                  <div className="md-section">
                    <h4 className="md-section-title">Historial entre sí</h4>
                    {(() => {
                      const total = (h2h.home_wins ?? 0) + (h2h.draws ?? 0) + (h2h.away_wins ?? 0);
                      const hp = total > 0 ? (h2h.home_wins / total) * 100 : 33;
                      const dp = total > 0 ? (h2h.draws     / total) * 100 : 34;
                      const ap = total > 0 ? (h2h.away_wins / total) * 100 : 33;
                      return (
                        <div className="md-h2h-bar-wrap">
                          <div className="md-h2h-bar-nums">
                            <span className="md-h2h-num">{h2h.home_wins}</span>
                            <span className="md-h2h-draws">{h2h.draws} empates</span>
                            <span className="md-h2h-num">{h2h.away_wins}</span>
                          </div>
                          <div className="md-h2h-bar">
                            <div style={{ width: `${hp}%`, background: 'var(--hm-accent)' }} />
                            <div style={{ width: `${dp}%`, background: 'var(--border)' }} />
                            <div style={{ width: `${ap}%`, background: 'var(--muted)' }} />
                          </div>
                          <div className="md-h2h-bar-labels">
                            <span>{detail.home_team}</span>
                            <span>{detail.away_team}</span>
                          </div>
                        </div>
                      );
                    })()}
                    {h2h.recent_matches?.length > 0 && (
                      <table className="md-h2h-table">
                        <tbody>
                          {h2h.recent_matches.map((m, i) => <H2HRow key={i} m={m} />)}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </>
            )}

            {activeTab === 'stats' && (
              <StatsTab data={stats.data} loading={stats.loading} error={stats.error} />
            )}

            {activeTab === 'alineaciones' && (
              <LineupsTab data={lineups.data} loading={lineups.loading} error={lineups.error} />
            )}

            {activeTab === 'incidencias' && (
              <IncidentsTab data={incidents.data} loading={incidents.loading} error={incidents.error} detail={detail} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
