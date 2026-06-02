export function LoadingOverlay({
  visible,
  title = '正在处理',
  message = '请稍等，不要重复点击。'
}: {
  visible: boolean;
  title?: string;
  message?: string;
}) {
  if (!visible) return null;

  return (
    <div className="loading-overlay" role="status" aria-live="polite" aria-busy="true">
      <div className="loading-modal">
        <div className="loading-spinner" aria-hidden="true" />
        <div>
          <h3>{title}</h3>
          <p>{message}</p>
        </div>
      </div>
    </div>
  );
}
