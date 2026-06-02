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
    <div className="recommendation-card">
      <div className="feature-card-title">
        <h3>{item.title}</h3>
        <span className="badge good">{item.level}</span>
      </div>
      {item.launch_profile_id && (
        <p className="muted">
          启动项：{item.launch_profile_id}
          {launchProfileType ? `（${launchProfileType}）` : ''}
        </p>
      )}
      <p className="muted">
        推荐方案表示“应该走哪种联机流程”，不等于点击后已经联机。真正联机仍需要组网、服务端监听和游戏内加入。
      </p>
      <ol className="step-list">
        {item.required_actions.map((action) => (
          <li key={action}>{action}</li>
        ))}
      </ol>
      {item.launch_profile_id && onLaunch && (
        <button onClick={onLaunch} disabled={disabled}>
          {disabled ? '执行中...' : launchLabel}
        </button>
      )}
      {item.launch_profile_id && !onLaunch && <p className="muted">请先选择游戏后再执行启动项。</p>}
    </div>
  );
}
