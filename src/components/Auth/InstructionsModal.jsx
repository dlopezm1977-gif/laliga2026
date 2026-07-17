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
          <h3>⚽ Puntuación</h3>
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
          <h3>⏰ ¿Hasta cuándo puedo predecir?</h3>
          <p>Cada jornada se <strong>cierra automáticamente</strong> en el momento en que arranca el primer partido. A partir de ese instante las predicciones quedan en modo solo lectura.</p>
        </section>

        <section className="instructions-section">
          <h3>📱 Pestañas</h3>
          <ul className="instructions-tabs">
            <li><strong>Calendario</strong> — Partidos y resultados de cada jornada. Disponible sin cuenta.</li>
            <li><strong>Clasificación</strong> — Tabla actualizada de LaLiga. Disponible sin cuenta.</li>
            <li><strong>Predecir</strong> — Mete tus predicciones antes del cierre. Requiere cuenta.</li>
            <li><strong>Ranking</strong> — Clasificación global de todos los jugadores. Requiere cuenta.</li>
            <li><strong>Historial</strong> — Tus predicciones pasadas y estadísticas. Requiere cuenta.</li>
          </ul>
        </section>

        <section className="instructions-section">
          <h3>👤 Perfil</h3>
          <p>Desde tu avatar (arriba a la derecha) puedes cambiar tu nombre y elegir tu equipo favorito para destacarlo en el calendario y la clasificación.</p>
        </section>

        <button className="btn-primary instructions-btn-close" onClick={onClose}>Entendido</button>
      </div>
    </div>
  );
}
