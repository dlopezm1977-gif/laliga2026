export default function LoadingSpinner({ text = 'Cargando…' }) {
  return (
    <div className="loading">
      <img src={`${import.meta.env.BASE_URL}icon-load.png`} alt="" className="loading-icon" />
      {text}
    </div>
  );
}
