type Page = 'home' | 'wizard' | 'scan' | 'detail' | 'network' | 'recommendation' | 'diagnostics' | 'adapters';

const playerPath = [
  ['1', '先更新方案库', '进入“适配器管理”，点击一键更新共享适配器，让客户端知道更多游戏的推荐联机方式。'],
  ['2', '扫描本机游戏', '进入“游戏扫描”，选择你要联机的游戏。没有扫到也可以手动看通用组网。'],
  ['3', '启动通用组网', '房主和朋友使用同一个房间名、密钥、supernode，并分别填写不同虚拟 IP。'],
  ['4', '按游戏说明加入', '支持直接 IP 的游戏优先连接房主虚拟 IP；需要服务端的游戏先由房主启动服务端。']
];

const hostSteps = [
  '准备一个可用的 supernode，或使用你已经部署好的 VPS 节点。',
  '在通用组网中心启动 n2n，确认状态变为可用。',
  '启动游戏房间或专用服务端。Terraria 可以使用专用向导。',
  '复制邀请信息发给朋友，让朋友使用不同的虚拟 IP 加入。'
];

const joinerSteps = [
  '向房主要 community、密钥、supernode、房主虚拟 IP 和游戏端口。',
  '在通用组网中心填写同一套组网信息，但使用自己的虚拟 IP。',
  '启动 n2n 后，等待状态可用。',
  '在游戏内选择 Join via IP / 直连 IP，输入房主虚拟 IP。'
];

const helpItems = [
  ['组网失败', '先看通用组网中心是否检测到 ACK / PONG，确认 supernode 地址、端口和防火墙。'],
  ['能组网但进不了游戏', '确认房主游戏服务端已经启动，并且游戏端口正在监听。必要时使用 TCP 或 UDP 代理。'],
  ['房间列表看不到', '如果游戏依赖局域网广播，优先尝试直接 IP；不支持直连时再尝试 UDP 广播桥。'],
  ['不知道下一步', '进入诊断报告，复制报告给维护者或管理员定位问题。']
];

export function HomePage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  return <section className="page-stack">
    <div className="hero-panel">
      <div>
        <span className="eyebrow">LAN HELPER</span>
        <h2>把朋友拉进同一个虚拟局域网，再按游戏方式联机</h2>
        <p>联机助手会帮你整理组网、端口、游戏说明和邀请信息。第一次使用建议从“更新方案库 → 扫描游戏 → 通用组网 → 复制邀请”开始。</p>
        <div className="actions">
          <button onClick={() => onNavigate('adapters')}>一键更新方案库</button>
          <button className="secondary" onClick={() => onNavigate('scan')}>扫描本机游戏</button>
          <button className="secondary" onClick={() => onNavigate('network')}>进入通用组网</button>
        </div>
      </div>
      <div className="hero-status-card">
        <div className="feature-card-title">
          <h3>第一次使用</h3>
          <span className="badge warn">按顺序来</span>
        </div>
        <ol className="compact-list">
          <li>房主和朋友都打开联机助手。</li>
          <li>双方使用同一个房间名、密钥和 supernode。</li>
          <li>每个人填写不同的虚拟 IP。</li>
          <li>游戏里连接房主虚拟 IP。</li>
        </ol>
      </div>
    </div>

    <div className="notice-card"><strong>重要提示：</strong>本工具不能保证所有游戏都一键成功。优先支持 LAN / IP 直连 / 专用服务端类游戏；遇到失败请使用诊断报告定位。</div>

    <div className="section-header"><div><span className="eyebrow">QUICK START</span><h3>普通玩家路径</h3><p className="muted">不用理解复杂网络原理，按下面顺序完成即可。</p></div></div>
    <div className="feature-grid">{playerPath.map(([step, title, desc]) => <article className="card mini-card" key={step}><span className="step-dot">{step}</span><h3>{title}</h3><p className="muted">{desc}</p></article>)}</div>

    <div className="feature-grid two">
      <article className="card">
        <h3>我是房主</h3>
        <ol className="compact-list">{hostSteps.map((item) => <li key={item}>{item}</li>)}</ol>
        <div className="actions"><button onClick={() => onNavigate('network')}>启动组网</button><button className="secondary" onClick={() => onNavigate('wizard')}>Terraria 开服</button></div>
      </article>
      <article className="card">
        <h3>我是加入者</h3>
        <ol className="compact-list">{joinerSteps.map((item) => <li key={item}>{item}</li>)}</ol>
        <div className="actions"><button onClick={() => onNavigate('network')}>填写邀请配置</button><button className="secondary" onClick={() => onNavigate('diagnostics')}>连接失败诊断</button></div>
      </article>
    </div>

    <div className="section-header"><div><span className="eyebrow">HELP</span><h3>常见情况</h3><p className="muted">如果联机失败，先按现象排查。</p></div></div>
    <div className="feature-grid two">{helpItems.map(([title, desc]) => <article className="card" key={title}><h3>{title}</h3><p className="muted">{desc}</p></article>)}</div>
  </section>;
}
