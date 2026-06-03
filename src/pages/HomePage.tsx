import { useMemo, useState } from 'react';

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

export function HomePage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const [role, setRole] = useState<Role>('host');
  const [scenario, setScenario] = useState<Scenario>('ip');
  const currentScenario = scenarios[scenario];
  const steps = role === 'host' ? hostSteps : joinerSteps;
  const readinessScore = useMemo(() => role === 'host' ? 62 : 48, [role]);

  return <section className="page-stack premium-home">
    <div className="premium-hero">
      <div className="hero-copy-block">
        <h2>从“能不能连”到“下一步怎么做”</h2>
        <p>选择你的身份和游戏联机方式，联机助手会把方案库、游戏扫描、n2n 组网、服务端、邀请包和诊断串成一条可执行路径。</p>
        <div className="role-switch" role="tablist" aria-label="选择身份">
          <button className={role === 'host' ? 'active' : 'secondary'} onClick={() => setRole('host')}>我是房主</button>
          <button className={role === 'joiner' ? 'active' : 'secondary'} onClick={() => setRole('joiner')}>我是加入者</button>
        </div>
        <div className="actions hero-actions">
          <button onClick={() => onNavigate(role === 'host' ? 'adapters' : 'network')}>{role === 'host' ? '开始准备房间' : '填写好友邀请'}</button>
          <button className="secondary" onClick={() => onNavigate('diagnostics')}>连接失败诊断</button>
        </div>
      </div>

      <div className="mission-panel">
        <div className="mission-score" aria-label="准备度">
          <span>{readinessScore}%</span>
          <small>{role === 'host' ? '房主准备度' : '加入者准备度'}</small>
        </div>
        <div className="mission-route">
          {steps.map((step, index) => <div className="mission-node" key={step}><span>{index + 1}</span><strong>{step}</strong></div>)}
        </div>
      </div>
    </div>

    <div className="interactive-stage">
      <article className="stage-card scenario-picker">
        <h3>选择本次联机场景</h3>
        <div className="scenario-list">
          {(Object.keys(scenarios) as Scenario[]).map((key) => (
            <button key={key} className={scenario === key ? 'scenario-option active' : 'scenario-option'} onClick={() => setScenario(key)}>
              <strong>{scenarios[key].title}</strong>
              <small>{scenarios[key].desc}</small>
            </button>
          ))}
        </div>
      </article>

      <article className="stage-card topology-card">
        <div className="feature-card-title">
          <div>
            <h3>{currentScenario.title}</h3>
            <p className="muted">{currentScenario.desc}</p>
          </div>
          <span className="badge warn">{role === 'host' ? '房主路径' : '加入者路径'}</span>
        </div>
        <div className="network-map" aria-label="联机拓扑示意">
          <div className="map-node host-node">房主<br /><span>10.10.10.2</span></div>
          <div className="map-line"><span>supernode</span></div>
          <div className="map-node friend-node">好友<br /><span>10.10.10.3</span></div>
        </div>
        <div className="actions">
          <button onClick={() => onNavigate(currentScenario.route)}>{currentScenario.action}</button>
          <button className="secondary" onClick={() => onNavigate('scan')}>先扫描游戏</button>
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
