export function StatusBadge({ label, tone = 'neutral' }: { label: string; tone?: 'good' | 'warn' | 'bad' | 'neutral' }) {
  return <span className={`badge ${tone}`}>{label}</span>;
}
