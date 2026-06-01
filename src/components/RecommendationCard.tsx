import type { Recommendation } from '../types/recommendation';

export function RecommendationCard({
  item,
  onLaunch,
  disabled = false
}: {
  item: Recommendation;
  onLaunch?: () => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <h3>{item.title}</h3>
      <p>等级：{item.level}</p>
      {item.launch_profile_id && <p>启动项：{item.launch_profile_id}</p>}
      <ul>
        {item.required_actions.map((action) => (
          <li key={action}>{action}</li>
        ))}
      </ul>
      {item.launch_profile_id && onLaunch && (
        <button onClick={onLaunch} disabled={disabled}>
          {disabled ? '执行中...' : '执行推荐启动项'}
        </button>
      )}
      {item.launch_profile_id && !onLaunch && <p className="muted">请先选择游戏后再执行启动项。</p>}
    </div>
  );
}
