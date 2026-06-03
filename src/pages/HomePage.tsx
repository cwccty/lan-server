import { useState } from 'react';

type Page = 'home' | 'wizard' | 'scan' | 'detail' | 'network' | 'recommendation' | 'diagnostics' | 'adapters';
type Role = 'host' | 'joiner';
type Scenario = 'ip' | 'server' | 'broadcast';

const scenarios: Record<Scenario, { title: string; desc: string; route: Page; action: string }> = {
  ip: { title: '直接 IP 联机', desc: '游戏支持 Join via IP / 直连房主虚拟 IP。', route: 'network', action: '配置通用组网' },
  server: { title: '专用服务端', desc: 'Terraria、Minecraft Java 等需要房主启动服务端。', route: 'wizard', action: '打开开服向导' },
  broadcast: { title: '房间列表发现', desc: '游戏依赖 LAN 房间列表，可能需要 UDP 广播桥。', route: 'recommendation', action: '查看推荐方案' }
};

const readiness = [
  ['方案库', '先更新共享方案，让客户端知道更多游戏怎么连。'],
  ['游戏', '扫描本机游戏，选择本次要联机的目标。'],
  ['组网', '双方使用同一 room、secret、supernode。'],
  ['端口', '房主启动游戏房间或服务端，再检查端口。']
];

const hostSteps = ['更新方案库', '扫描游戏', '启动 n2n', '启动服务端/房间', '复制邀请包'];
const joinerSteps = ['接收邀请', '填写相同组网信息', '使用不同虚拟 IP', '启动 n2n', '连接房主虚拟 IP'];
const checklist = ['虚拟局域网网卡', 'supernode 节点就绪', '游戏端口待检测', '邀请包可生成'];

export function HomePage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const [role, setRole] = useState<Role>('host');
  const [scenario, setScenario] = useState<Scenario>('ip');
  const currentScenario = scenarios[scenario];
  const steps = role === 'host' ? hostSteps : joinerSteps;

  return <section className="page-stack premium-home">
    <div className="lobby-page-title">
      <h2>桌面大厅</h2>
      <p>确定您在网络拓扑中的角色，并优化连接准备流程。</p>
    </div>

    <div className="premium-hero">
      <div className="hero-copy-block">
        <h3>选择联机角色</h3>
        <p>主机负责启动游戏自建服务器；加入者通过主机的虚拟网段接入。</p>
        <div className="role-switch" role="tablist" aria-label="选择身份">
          <button className={role === 'host' ? 'active' : 'secondary'} onClick={() => setRole('host')}>▱ 我是主机 Host</button>
          <button className={role === 'joiner' ? 'active' : 'secondary'} onClick={() => setRole('joiner')}>♙ 我是加入者 Joiner</button>
        </div>
        <div className="actions hero-actions">
          <button onClick={() => onNavigate(role === 'host' ? 'network' : 'network')}>{role === 'host' ? '配置本地网络' : '导入好友邀请'}</button>
          <button className="secondary" onClick={() => onNavigate('scan')}>扫描本地游戏</button>
        </div>
      </div>

      <div className="mission-panel">
        <h3>就绪进度</h3>
        <div className="mission-score" aria-label="准备度">
          <span>待测</span>
          <small>等待诊断</small>
        </div>
        <p className="muted">需要运行诊断后替换为真实检测进度。当前不伪造在线结果。</p>
      </div>
    </div>

    <div className="lobby-bottom-grid">
      <article className="card topology-status-card">
        <div className="feature-card-title">
          <div>
            <h3>网络拓扑状态</h3>
            <p className="muted">当前选择：{currentScenario.title}。{currentScenario.desc}</p>
          </div>
          <span className="badge warn">等待真实检测</span>
        </div>
        <div className="network-map lobby-network-map" aria-label="网络拓扑状态">
          <div className="map-node host-node">本机（主机）<br /><span>10.10.10.2</span></div>
          <div className="map-line"><span>supernode</span></div>
          <div className="map-node friend-node">联机好友群组<br /><span>待加入...</span></div>
        </div>
        <div className="scenario-pill-row" aria-label="联机场景">
          {(Object.keys(scenarios) as Scenario[]).map((key) => (
            <button key={key} className={scenario === key ? 'scenario-pill active' : 'scenario-pill'} onClick={() => setScenario(key)}>
              {scenarios[key].title}
            </button>
          ))}
        </div>
        <div className="actions topology-actions">
          <button onClick={() => onNavigate(currentScenario.route)}>{currentScenario.action}</button>
          <button className="secondary" onClick={() => onNavigate('diagnostics')}>查看诊断</button>
        </div>
      </article>

      <article className="card lobby-checklist-card">
        <h3>主面板检查单</h3>
        <ul className="lobby-checklist">
          {checklist.map((item, index) => (
            <li key={item}>
              <span className={index < 2 ? 'check-dot ok' : 'check-dot wait'}>{index < 2 ? '✓' : '!'}</span>
              <div>
                <strong>{item}</strong>
                <small>{index < 2 ? '等待诊断确认真实状态。' : '需要进入对应页面处理。'}</small>
              </div>
            </li>
          ))}
        </ul>
        <div className="host-flow-strip">
          {steps.map((step, index) => (
            <span key={step}>{index + 1}. {step}</span>
          ))}
        </div>
      </article>
    </div>

    <div className="readiness-grid">
      {readiness.map(([title, desc], index) => (
        <article className="readiness-card" key={title}>
          <span>{index + 1}</span>
          <h3>{title}</h3>
          <p>{desc}</p>
          <button className="secondary" onClick={() => onNavigate(index === 0 ? 'adapters' : index === 1 ? 'scan' : index === 2 ? 'network' : 'recommendation')}>处理这一项</button>
        </article>
      ))}
    </div>

    <article className="diagnostic-strip">
      <div>
        <h3>不确定哪里失败？</h3>
        <p>生成诊断报告，按 n2n、supernode、虚拟 IP、端口和当前游戏逐项定位。</p>
      </div>
      <button onClick={() => onNavigate('diagnostics')}>生成诊断报告</button>
    </article>
  </section>;
}
