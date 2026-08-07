import { useState } from 'react';
import { crestUrl } from '../../lib/crests';

const ABBR = {
  'Real Madrid': 'RMA', 'Barcelona': 'BAR', 'Atlético': 'ATM',
  'Sevilla': 'SEV', 'Betis': 'BET', 'Real Sociedad': 'RSO',
  'Villarreal': 'VIL', 'Athletic': 'ATH', 'Valencia': 'VAL',
  'Osasuna': 'OSA', 'Celta': 'CEL', 'Getafe': 'GET',
  'Rayo': 'RAY', 'Alavés': 'ALA', 'Espanyol': 'ESP',
  'Racing': 'RAC', 'Levante': 'LEV', 'Deportivo': 'DEP',
  'Elche': 'ELC', 'Málaga': 'MAL',
};

const SECTIONS = [
  { key: 'ganadorLiga',   label: '🏆 Campeón de Liga',   pts: '25 pts',     type: 'single' },
  { key: 'champions',     label: '⭐ Champions League',   pts: '10 pts c/u', type: 'multi'  },
  { key: 'uel',           label: '🟠 Europa League',      pts: '7 pts',      type: 'single' },
  { key: 'uecl',          label: '🟢 Conference League',  pts: '5 pts',      type: 'single' },
  { key: 'descenso',      label: '⬇️ Descenso',           pts: '10 pts c/u', type: 'multi'  },
  { key: 'mejorPorteria', label: '🧤 Mejor portería',     pts: '15 pts',     type: 'single' },
  { key: 'empatador',     label: '⚖️ Más empates',        pts: '10 pts',     type: 'single' },
];

function TeamList({ teams }) {
  if (teams.length === 0) return <span style={{ color: 'var(--muted)', fontSize: '.72rem' }}>–</span>;
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: '.15rem' }}>
      {teams.map(t => (
        <span key={t} style={{ display: 'flex', alignItems: 'center', gap: '.2rem' }}>
          <img className="team-crest team-crest--sm" src={crestUrl(t)} alt={t} />
          <span style={{ fontSize: '.78rem', fontFamily: 'var(--mono)' }}>{ABBR[t] || t}</span>
        </span>
      ))}
    </span>
  );
}

function Body({ pred, open }) {
  if (!open) return null;
  return (
    <div style={{ padding: '.15rem .2rem .3rem', borderBottom: '1px solid var(--border)' }}>
      <div className="history-col-headers">
        <span /><span>Pred</span><span>Real</span><span />
      </div>
      {SECTIONS.map(sec => {
        const value = pred[sec.key];
        const teams = sec.type === 'multi' ? (value || []) : (value ? [value] : []);
        return (
          <div key={sec.key} className="history-match-row" style={{ gap: '.5rem' }}>
            <span className="teams">
              <span className="teams-text" style={{ color: 'var(--muted)' }}>
                <span className="team-full">{sec.label}</span>
                <span className="team-abbr" style={{ fontSize: '.6rem', opacity: .8, fontFamily: 'var(--mono)' }}>
                  {sec.pts}
                </span>
              </span>
            </span>
            <span className="pred"><TeamList teams={teams} /></span>
            <span className="real" style={{ color: 'var(--muted)' }}>?</span>
            <span className="result-badge miss" style={{ opacity: .4 }}>–</span>
          </div>
        );
      })}
    </div>
  );
}

export default function SeasonPredCard({ pred, variant = 'history' }) {
  const [open, setOpen] = useState(false);
  if (!pred) return null;
  const hasAny = SECTIONS.some(s => {
    const v = pred[s.key];
    return s.type === 'multi' ? v?.length > 0 : !!v;
  });
  if (!hasAny) return null;

  if (variant === 'ranking') {
    return (
      <div>
        <div
          className="rank-detail-row"
          onClick={() => setOpen(o => !o)}
          style={{ cursor: 'pointer', userSelect: 'none' }}
        >
          <span style={{ fontWeight: 600 }}>Global de temporada</span>
          <span><span className="monthly-badge">temporada</span></span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
            <span className="j-pts" style={{ fontSize: '.95rem' }}>0 pts</span>
            <span style={{ color: 'var(--muted)', fontSize: '.7rem' }}>{open ? '▲' : '▼'}</span>
          </span>
        </div>
        <Body pred={pred} open={open} />
      </div>
    );
  }

  return (
    <div className="history-jornada">
      <div className="history-jornada-hdr" onClick={() => setOpen(o => !o)}>
        <span style={{ fontWeight: 600 }}>Global de temporada</span>
        <span className="monthly-badge">temporada</span>
        <span className="j-pts">0 pts</span>
        <span style={{ color: 'var(--muted)', fontSize: '.8rem' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className="history-jornada-body">
          <div className="history-col-headers">
            <span /><span>Pred</span><span>Real</span><span />
          </div>
          {SECTIONS.map(sec => {
            const value = pred[sec.key];
            const teams = sec.type === 'multi' ? (value || []) : (value ? [value] : []);
            return (
              <div key={sec.key} className="history-match-row" style={{ gap: '.5rem' }}>
                <span className="teams">
                  <span className="teams-text" style={{ color: 'var(--muted)' }}>
                    <span className="team-full">{sec.label}</span>
                    <span className="team-abbr" style={{ fontSize: '.6rem', opacity: .8, fontFamily: 'var(--mono)' }}>
                      {sec.pts}
                    </span>
                  </span>
                </span>
                <span className="pred"><TeamList teams={teams} /></span>
                <span className="real" style={{ color: 'var(--muted)' }}>?</span>
                <span className="result-badge miss" style={{ opacity: .4 }}>–</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
