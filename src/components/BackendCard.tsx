import type { BackendSummary } from '../types/network';

export function BackendCard({ backend }: { backend: BackendSummary }) {
  return (
    <article className={backend.available ? 'card backend-card available' : 'card backend-card'}>
      <div className="feature-card-title">
        <h3>{backend.name}</h3>
        <span className={backend.available ? 'badge good' : 'badge bad'}>
          {backend.available ? '可用' : '不可用'}
        </span>
      </div>
      {backend.virtual_ip && <p>虚拟 IP：<strong>{backend.virtual_ip}</strong></p>}
      {backend.notes.length > 0 && (
        <ul className="compact-list">
          {backend.notes.map((note) => <li key={note}>{note}</li>)}
        </ul>
      )}
    </article>
  );
}
