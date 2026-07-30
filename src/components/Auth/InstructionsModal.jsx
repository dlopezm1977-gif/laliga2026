export default function InstructionsModal({ onClose }) {
  return (
    <div className="instructions-overlay" onClick={onClose}>
      <div className="instructions-modal" onClick={e => e.stopPropagation()}>
        <button className="instructions-close" onClick={onClose}>✕</button>

        <div className="instructions-header">
          <img src={`${import.meta.env.BASE_URL}icon-info.png`} alt="" className="instructions-icon" />
          <h2 className="instructions-title">¿Cómo funciona?</h2>
        </div>

        <section className="instructions-section">
          <h3>🏆 La quiniela</h3>
          <p>Predice el marcador exacto de cada partido de LaLiga antes de que empiece la jornada. Cuantos más aciertos, más puntos.</p>
        </section>

        <section className="instructions-section">
          <h3>⚽ Puntuación por jornada</h3>
          <div className="instructions-scores">
            <div className="score-row">
              <span className="score-badge exact">Exacto</span>
              <span>Marcador exacto correcto → <strong>3 puntos</strong></span>
            </div>
            <div className="score-row">
              <span className="score-badge sign">Signo</span>
              <span>Aciertas el resultado (1X2) pero no el marcador → <strong>1 punto</strong></span>
            </div>
            <div className="score-row">
              <span className="score-badge miss">Fallo</span>
              <span>Resultado incorrecto → <strong>0 puntos</strong></span>
            </div>
          </div>
        </section>

        <section className="instructions-section">
          <h3>⭐ Favorito</h3>
          <p>En cada jornada puedes marcar un equipo como <strong>favorito</strong> tocando la estrella (☆) junto a su nombre. Si aciertas el partido de ese equipo —exacto o signo— los puntos se <strong>duplican</strong>. El favorito queda fijado en el momento en que se cierra la jornada, pero puedes cambiarlo antes.</p>
        </section>

        <section className="instructions-section">
          <h3>📅 Predicciones Mensuales</h3>
          <p>Cada mes puedes predecir tres categorías desde <strong>Predecir → Mensual</strong>. Se cierran al inicio del mes correspondiente.</p>
          <div className="instructions-scores" style={{ marginTop: '.5rem' }}>
            <div className="score-row"><span className="score-badge exact">+10 pts</span><span>🏆 Jugador del mes acertado</span></div>
            <div className="score-row"><span className="score-badge exact">+10 pts</span><span>🧑‍💼 Entrenador del mes acertado</span></div>
            <div className="score-row"><span className="score-badge exact">+10 pts</span><span>⭐ Sub-23 del mes acertado</span></div>
          </div>
          <p style={{ marginTop: '.4rem', fontSize: '.8rem' }}>Máximo <strong>30 pts</strong> por mes.</p>
        </section>

        <section className="instructions-section">
          <h3>🌍 Predicciones Generales</h3>
          <p>Antes de que empiece la Jornada 1 puedes hacer predicciones de temporada desde <strong>Predecir → General</strong>. Los puntos se calculan al final de la temporada.</p>
          <div className="instructions-scores" style={{ marginTop: '.5rem' }}>
            <div className="score-row"><span className="score-badge exact">25 pts</span><span>Campeón de Liga</span></div>
            <div className="score-row"><span className="score-badge exact">10 pts</span><span>Cada equipo Champions acertado (de 4)</span></div>
            <div className="score-row"><span className="score-badge sign">7 pts</span><span>Europa League</span></div>
            <div className="score-row"><span className="score-badge sign">5 pts</span><span>Conference League</span></div>
            <div className="score-row"><span className="score-badge sign">10 pts</span><span>Cada equipo descendido acertado (de 3)</span></div>
            <div className="score-row"><span className="score-badge sign">15 pts</span><span>Mejor portería</span></div>
            <div className="score-row"><span className="score-badge sign">10 pts</span><span>Equipo con más empates</span></div>
          </div>
        </section>

        <section className="instructions-section">
          <h3>⏰ ¿Hasta cuándo puedo predecir?</h3>
          <ul className="instructions-tabs">
            <li><strong>Jornada</strong> — Se cierra cuando arranca el primer partido de la jornada.</li>
            <li><strong>Mensual</strong> — Se cierra al inicio del mes correspondiente.</li>
            <li><strong>General</strong> — Se cierra al inicio de la Jornada 1.</li>
          </ul>
        </section>

        <section className="instructions-section">
          <h3>📱 Pestañas</h3>
          <ul className="instructions-tabs">
            <li><strong>Calendario</strong> — Partidos y resultados de cada jornada.</li>
            <li><strong>Clasificación</strong> — Tabla actualizada de LaLiga y goleadores.</li>
            <li><strong>Predecir</strong> — Predicciones por jornada, mensuales y generales de temporada.</li>
            <li><strong>Ranking</strong> — Clasificación global de todos los participantes.</li>
            <li><strong>Historial</strong> — Tus predicciones pasadas y estadísticas.</li>
          </ul>
        </section>

        <section className="instructions-section">
          <h3>👤 Perfil</h3>
          <p>Desde tu avatar (arriba a la derecha) puedes cambiar tu nombre y elegir tu equipo favorito. Ese equipo se usará como favorito por defecto en cada jornada.</p>
        </section>

        <button className="btn-primary instructions-btn-close" onClick={onClose}>Entendido</button>
      </div>
    </div>
  );
}
