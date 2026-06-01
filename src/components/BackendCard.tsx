import type { BackendSummary } from '../types/network';

export function BackendCard({ backend }: { backend: BackendSummary }) {
  return (
    <article className="card">
      <h3>{backend.name}</h3>
      <p>{backend.available ? '可用' : '不可用'}</p>
      <p>{backend.notes.join('；')}</p>
    </article>
  );
}
