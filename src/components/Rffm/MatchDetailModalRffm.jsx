import { useState, useEffect } from 'react';
import { crestUrlRffm } from '../../lib/crests';
import { shortName } from '../../lib/rffmTeams';
import { useCampoRffm } from '../../hooks/useCampoRffm';
import LoadingSpinner from '../LoadingSpinner';

/* ── Formato de nombre ─────────────────────────────────────── */

// "RODRIGUEZ QUINTANILLA, JOSE MARIA" → "Jose Maria Rodríguez"
function capWord(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';
}
function capWords(s) {
  return (s ?? '').split(' ').map(capWord).join(' ');
}
function shortPlayerName(raw) {
  if (!raw) return '—';
  const [apellidos, nombre] = raw.split(', ');
  if (!nombre) return capWords(raw);
  return `${capWords(nombre)} ${capWord((apellidos ?? '').split(' ')[0])}`;
}

/* ── Helpers de posición ───────────────────────────────────── */

const POS_ABREV_MAP = {
  LD: 'D', LI: 'D', DFC: 'D', DF: 'D', DFCD: 'D', DFCI: 'D',
  MC: 'M', MI: 'M', MD: 'M', MCD: 'M', MCO: 'M', MEQ: 'M',
  DC: 'F', EI: 'F', ED: 'F', SD: 'F', MP: 'F',
};
const POS_ORDER = { G: 0, D: 1, M: 2, F: 3 };
const POS_LABEL = { G: 'POR', D: 'DEF', M: 'MED', F: 'DEL' };
const POS_COLOR = { G: '#1a8f4e', D: '#2a6dd9', M: '#c8a000', F: '#d94040' };

function rffmPosCategory(p) {
  if (p.portero) return 'G';
  return POS_ABREV_MAP[p.posicionAbrev] ?? 'M';
}

function toLineupPlayer(p) {
  return {
    jersey_number: p.dorsal,
    short_name:    shortPlayerName(p.nombre),
    position:      rffmPosCategory(p),
    captain:       p.capitan,
  };
}

// Las formaciones RFFM incluyen el portero: "1-3-5-2" → "3-5-2" para el pitch
function outfieldFormation(f) {
  return (f ?? '').startsWith('1-') ? f.slice(2) : (f ?? '');
}

/* ── Pitch SVG ─────────────────────────────────────────────── */

function buildPitchRows(players, formation) {
  const gk       = players.filter(p => p.position === 'G');
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

  const Y_GK = 54, Y_TOP = 12, Y_BOT = 42;
  const step = outfieldRows.length > 1 ? (Y_BOT - Y_TOP) / (outfieldRows.length - 1) : 0;

  return [
    { players: gk, y: Y_GK },
    ...outfieldRows.map((rowPlayers, i) => ({ players: rowPlayers, y: Y_BOT - i * step })),
  ];
}

function FormationPitch({ players, formation }) {
  const rows = buildPitchRows(players, formation);
  const dots = rows.flatMap(({ players: rp, y }) =>
    rp.map((player, i, arr) => ({
      player, y,
      x: (80 / (arr.length + 1)) * (i + 1),
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
      <rect x="22"  y="1.5" width="36" height="16" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.7" />
      <rect x="30"  y="1.5" width="20" height="7"  fill="none" stroke="rgba(255,255,255,0.3)"  strokeWidth="0.6" />
      <rect x="33"  y="0"   width="14" height="1.5" fill="rgba(255,255,255,0.55)" />
      <circle cx="40" cy="13" r="0.8" fill="rgba(255,255,255,0.5)" />
      <line x1="1.5" y1="60.5" x2="78.5" y2="60.5" stroke="rgba(255,255,255,0.3)" strokeWidth="0.7" />
      {dots.map(({ x, y, color, player }, i) => (
        <circle key={i} cx={x} cy={y} r="4.5" fill={color} />
      ))}
    </svg>
  );
}

function PlayerRow({ p, dimmed }) {
  const pos = p.position;
  return (
    <div className="md-lineup-player" style={dimmed ? { opacity: .65 } : undefined}>
      <span className="md-lineup-num">{p.jersey_number ?? ''}</span>
      <span className="md-lineup-name">{p.short_name ?? '—'}{p.captain ? ' ©' : ''}</span>
      {pos && (
        <span className={`md-lineup-pos md-lineup-pos--${pos.toLowerCase()}`}>
          {POS_LABEL[pos] ?? pos}
        </span>
      )}
    </div>
  );
}

function LineupTeamRffm({ rawPlayers, formation, coach, label }) {
  const starters = (rawPlayers ?? [])
    .filter(p => p.titular)
    .map(toLineupPlayer)
    .sort((a, b) => (POS_ORDER[a.position] ?? 9) - (POS_ORDER[b.position] ?? 9));

  const bench = (rawPlayers ?? [])
    .filter(p => p.suplente)
    .map(toLineupPlayer);

  return (
    <div className="md-lineup-col">
      <div className="md-lineup-header">{label}</div>
      {formation && <div className="md-lineup-formation">{formation}</div>}
      <FormationPitch players={starters} formation={outfieldFormation(formation)} />
      {starters.map((p, i) => <PlayerRow key={i} p={p} />)}
      {bench.length > 0 && (
        <>
          <div className="md-lineup-divider">Suplentes</div>
          {bench.map((p, i) => <PlayerRow key={i} p={p} dimmed />)}
        </>
      )}
      {coach && (
        <>
          <div className="md-lineup-divider">Técnico</div>
          <div className="md-lineup-player" style={{ opacity: .8 }}>
            <span className="md-lineup-num" style={{ fontSize: '.9em' }}>🎽</span>
            <span className="md-lineup-name">{shortPlayerName(coach.nombre)}</span>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Incidencias ───────────────────────────────────────────── */

function GoalItemRffm({ g }) {
  const isOwnGoal = g.tipo === '102';
  const isPenalty = g.tipo === '101';
  return (
    <div className="md-inc-item md-inc-item--goal">
      <span className="md-inc-min">{g.minuto}'</span>
      <span className="md-inc-player">⚽ {shortPlayerName(g.nombre)}</span>
      {isOwnGoal && <span className="md-inc-note">(PP)</span>}
      {isPenalty  && <span className="md-inc-note">(P)</span>}
    </div>
  );
}

function CardItemRffm({ c }) {
  const isRed = c.tipo === '200' || c.segundaAmarilla;
  const cls   = isRed ? 'red' : 'yellow';
  return (
    <div className="md-inc-item">
      <span className="md-inc-min">{c.minuto}'</span>
      <span className={`md-card md-card--${cls}`} style={{ margin: '0 .2rem' }} />
      <span className="md-inc-player">{shortPlayerName(c.nombre)}</span>
      {c.segundaAmarilla && <span className="md-inc-note">(2ª)</span>}
    </div>
  );
}

function SubItemRffm({ s }) {
  return (
    <div className="md-inc-item">
      <span className="md-inc-min">{s.minuto}'</span>
      <div className="md-inc-sub-wrap">
        {s.entra && <div><span className="md-inc-arrow md-inc-arrow--in">↑</span> {shortPlayerName(s.entra.nombre)}</div>}
        {s.sale  && <div><span className="md-inc-arrow md-inc-arrow--out">↓</span> {shortPlayerName(s.sale.nombre)}</div>}
      </div>
    </div>
  );
}

function IncSectionRffm({ label, homeItems, awayItems, renderItem }) {
  if (!homeItems?.length && !awayItems?.length) return null;
  return (
    <div className="md-inc-section">
      <div className="md-inc-section-title">{label}</div>
      <div className="md-inc-cols">
        <div className="md-inc-col">
          {(homeItems ?? []).map((item, i) => <div key={i}>{renderItem(item)}</div>)}
        </div>
        <div className="md-inc-col md-inc-col--away">
          {(awayItems ?? []).map((item, i) => <div key={i}>{renderItem(item)}</div>)}
        </div>
      </div>
    </div>
  );
}

/* ── Main modal ────────────────────────────────────────────── */

const TABS = [
  { id: 'campo',        label: 'Campo' },
  { id: 'alineaciones', label: 'Alineación' },
  { id: 'incidencias',  label: 'Incidencias' },
];

function StatusBadge({ status }) {
  if (status === 'finished') return <span className="status-badge finished">Final</span>;
  if (status === 'live')     return <span className="status-badge live">En juego</span>;
  return <span className="status-badge scheduled">Próximo</span>;
}

export default function MatchDetailModalRffm({ match, detail, lineups, incidents, referees, loading, error, onClose }) {
  const [activeTab, setActiveTab] = useState('campo');
  const { campo, loading: campoLoading } = useCampoRffm(match?.venueCode);

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    setActiveTab('campo');
  }, [match?.matchId]);

  if (!match) return null;

  const isFinished = match.status === 'finished';
  const isLive     = match.status === 'live';
  const hasScore   = isFinished || isLive;
  const actaReady  = match.actaCerrada && !loading && !error && (lineups || incidents);

  const mapsUrl = campo?.lat && campo?.lng
    ? `https://www.google.com/maps/search/?api=1&query=${campo.lat},${campo.lng}`
    : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel match-detail-panel match-detail-panel--laliga" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>

        {/* Cabecera */}
        <div className="md-header">
          <div className="md-team">
            <img className="md-crest" src={crestUrlRffm(match.homeLogo)} alt={match.homeTeam} />
            <span className="md-team-name">{shortName(match.homeTeam)}</span>
          </div>
          <div className="md-score-block">
            {hasScore ? (
              <div className="md-score-main">
                <span>{match.homeScore}</span>
                <span className="md-sep">:</span>
                <span>{match.awayScore}</span>
              </div>
            ) : (
              <div className="md-score-main"><span className="md-vs">–</span></div>
            )}
            <div className="md-status"><StatusBadge status={match.status} /></div>
          </div>
          <div className="md-team">
            <img className="md-crest" src={crestUrlRffm(match.awayLogo)} alt={match.awayTeam} />
            <span className="md-team-name">{shortName(match.awayTeam)}</span>
          </div>
        </div>

        {match.fecha && (
          <div className="md-meta">
            <span>
              {new Date(match.fecha.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-ES', {
                weekday: 'long', day: 'numeric', month: 'long',
              })}
            </span>
            {match.hora && <span>· {match.hora}</span>}
          </div>
        )}

        {/* Tabs */}
        <div className="md-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`md-tab-btn${activeTab === t.id ? ' active' : ''}`}
              disabled={t.id !== 'campo' && !actaReady}
              title={t.id !== 'campo' && !actaReady ? 'Disponible cuando el acta esté cerrada' : undefined}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Loading del acta */}
        {loading && activeTab !== 'campo' && <LoadingSpinner text="Cargando acta…" />}

        {/* Error del acta */}
        {error && activeTab !== 'campo' && (
          <div className="empty-state" style={{ padding: '1rem' }}>
            <p style={{ color: 'var(--muted)', fontSize: '.85rem', textAlign: 'center' }}>{error}</p>
          </div>
        )}

        {/* Tab: Campo */}
        {activeTab === 'campo' && (
          <div className="md-section">
            {campoLoading ? (
              <div className="md-meta" style={{ color: 'var(--muted)', fontSize: '.8rem' }}>Cargando…</div>
            ) : campo ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.35rem', fontSize: '.82rem' }}>
                <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '.4rem' }}>
                  <span>🏟</span>{campo.nombre}
                </span>
                {(campo.direccion || campo.localidad) && (
                  <span style={{ color: 'var(--muted)' }}>
                    {[campo.direccion, campo.localidad].filter(Boolean).join(', ')}
                  </span>
                )}
                {(campo.superficie || campo.tipo) && (
                  <span style={{ color: 'var(--muted)' }}>
                    {[campo.tipo, campo.superficie].filter(Boolean).join(' · ')}
                  </span>
                )}
                {mapsUrl && (
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{
                    display: 'inline-flex', alignItems: 'center', gap: '.35rem',
                    marginTop: '.4rem', padding: '.35rem .75rem',
                    background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent)',
                    borderRadius: '999px', fontSize: '.75rem', fontWeight: 600,
                    textDecoration: 'none', letterSpacing: '.02em',
                  }}>
                    <svg width="10" height="12" viewBox="0 0 12 16" fill="currentColor" aria-hidden="true">
                      <path d="M6 0C3.24 0 1 2.24 1 5c0 4.25 5 11 5 11s5-6.75 5-11c0-2.76-2.24-5-5-5zm0 7.5A2.5 2.5 0 1 1 6 2.5 2.5 2.5 0 0 1 6 7.5z"/>
                    </svg>
                    Ver en Google Maps
                  </a>
                )}
              </div>
            ) : match.venue ? (
              <div className="md-meta">{match.venue}</div>
            ) : null}

            {referees?.length > 0 && (
              <div style={{ marginTop: '1.1rem', paddingTop: '.9rem', borderTop: '1px solid var(--border)' }}>
                {referees.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '.45rem', fontSize: '.82rem', marginTop: i > 0 ? '.3rem' : 0 }}>
                    <span style={{ fontSize: '1rem' }}>🚩</span>
                    <span style={{ color: 'var(--text)', fontWeight: 500 }}>{r.nombre}</span>
                    {r.tipo && r.tipo !== 'ARBITRO' && (
                      <span style={{ color: 'var(--muted)', fontSize: '.75rem' }}>{r.tipo}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Alineación */}
        {activeTab === 'alineaciones' && actaReady && lineups && (
          <div className="md-lineups">
            <LineupTeamRffm
              rawPlayers={lineups.home}
              formation={lineups.homeFormation}
              coach={lineups.homeCoach}
              label={shortName(match.homeTeam)}
            />
            <LineupTeamRffm
              rawPlayers={lineups.away}
              formation={lineups.awayFormation}
              coach={lineups.awayCoach}
              label={shortName(match.awayTeam)}
            />
          </div>
        )}

        {/* Tab: Incidencias */}
        {activeTab === 'incidencias' && actaReady && incidents && (
          <div className="md-incidents-v2">
            <div className="md-inc-col-headers">
              <span>{shortName(match.homeTeam)}</span>
              <span>{shortName(match.awayTeam)}</span>
            </div>
            <IncSectionRffm
              label={<>⚽ Goles</>}
              homeItems={incidents.goals?.home}
              awayItems={incidents.goals?.away}
              renderItem={g => <GoalItemRffm g={g} />}
            />
            <IncSectionRffm
              label={<><span className="md-card md-card--yellow" style={{ marginRight: 2 }} /><span className="md-card md-card--red" style={{ marginRight: 4 }} />Tarjetas</>}
              homeItems={incidents.cards?.home}
              awayItems={incidents.cards?.away}
              renderItem={c => <CardItemRffm c={c} />}
            />
            <IncSectionRffm
              label={<>🔄 Cambios</>}
              homeItems={incidents.subs?.home}
              awayItems={incidents.subs?.away}
              renderItem={s => <SubItemRffm s={s} />}
            />
            {!incidents.goals?.home?.length && !incidents.goals?.away?.length &&
             !incidents.cards?.home?.length && !incidents.cards?.away?.length &&
             !incidents.subs?.home?.length  && !incidents.subs?.away?.length  && (
              <p style={{ color: 'var(--muted)', textAlign: 'center', fontSize: '.82rem', padding: '.5rem 0' }}>
                Sin incidencias registradas.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
