import { useState, useEffect, useMemo } from 'react';

const PARTICLES = {
  halloween: { glyphs: ['🦇', '🎃', '🦇', '👻', '🕷️', '🎃'], mode: 'fall' },
  navidad:   { glyphs: ['🎅', '🎁', '❄️', '🎄', '🍬', '⭐'], mode: 'fall' },
};
const COUNT = 16;
const LIFETIME_MS = 11000;

// Efecto ligero que se reproduce una sola vez al cargar la página
export default function SeasonDecor({ season }) {
  const cfg = PARTICLES[season];
  const [done, setDone] = useState(false);

  const items = useMemo(() => cfg
    ? Array.from({ length: COUNT }, (_, i) => ({
        glyph: cfg.glyphs[i % cfg.glyphs.length],
        style: {
          '--x':  `${Math.round(Math.random() * 96)}%`,
          '--dx': `${Math.round((Math.random() - .5) * 90)}px`,
          '--d':  `${(Math.random() * 3).toFixed(2)}s`,
          '--t':  `${(5 + Math.random() * 3).toFixed(2)}s`,
          '--s':  `${(.8 + Math.random() * .8).toFixed(2)}rem`,
        },
      }))
    : [], [cfg]);

  useEffect(() => {
    if (!cfg) return;
    const t = setTimeout(() => setDone(true), LIFETIME_MS);
    return () => clearTimeout(t);
  }, [cfg]);

  if (!cfg || done || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return null;

  return (
    <div className={`season-decor season-decor--${cfg.mode}`} aria-hidden="true">
      {items.map((p, i) => <span key={i} className="season-particle" style={p.style}>{p.glyph}</span>)}
    </div>
  );
}
