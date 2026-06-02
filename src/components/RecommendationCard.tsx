import type { Recommendation } from '../types/recommendation';

export function RecommendationCard({
  item,
  onLaunch,
  disabled = false,
  launchProfileType
}: {
  item: Recommendation;
  onLaunch?: () => void;
  disabled?: boolean;
  launchProfileType?: string;
}) {
  const launchLabel =
    launchProfileType === 'server'
      ? '启动本地服务端'
      : launchProfileType === 'client'
        ? '启动游戏客户端'
        : '执行这个启动项';

  return (
    <div>
      <h3>{item.title}</h3>
      <p>等级：{item.level}</p>
      {item.launch_profile_id && (
        <p>
          启动项：{item.launch_profile_id}
          {launchProfileType ? `（${launchProfileType}）` : ''}
        </p>
      )}
      <p className="muted">
        注意：推荐方案是在告诉你“应该用哪种联机流程”。点击启动项只会启动游戏客户端或本地服务端，
        不等于已经完成本地联机。
      </p>
      <ul>
        {item.required_actions.map((action) => (
          <li key={action}>{action}</li>
        ))}
      </ul>
      {item.launch_profile_id && onLaunch && (
        <button onClick={onLaunch} disabled={disabled}>
          {disabled ? '执行中...' : launchLabel}
        </button>
      )}
      {item.launch_profile_id && !onLaunch && <p className="muted">请先选择游戏后再执行启动项。</p>}
    </div>
  );
}
