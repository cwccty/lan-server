type Page = 'home' | 'wizard' | 'scan' | 'detail' | 'network' | 'recommendation' | 'diagnostics' | 'adapters';

const playerPath = [
  ['1', '扫描游戏', '识别已安装游戏，匹配 builtin / registry / custom 适配器。'],
  ['2', '查看推荐方案', '确认游戏能否转换成本地/局域网体验，以及需要哪些组件。'],
  ['3', '启动通用组网', '先让玩家进入同一个虚拟局域网，再进入游戏联机。'],
  ['4', '复制配置给朋友', '保留通用邀请配置，不做房间聊天，减少额外复杂度。']
];

const productLayers = [
  ['组网层', 'n2n、Radmin、已有局域网、未来 ZeroTier/Tailscale。它不绑定具体游戏。'],
  ['游戏辅助层', 'Terraria/Minecraft 等服务端启动、端口、世界/存档选择和邀请信息。'],
  ['适配器层', '管理员认定游戏能力，生成可复用方案：custom > registry > builtin。'],
  ['诊断层', '状态必须来自真实后端、进程、端口、虚拟网卡、虚拟 IP 与日志。']
];

const statusItems = [['n2n edge', '等待真实检测', '未运行'], ['虚拟网卡', '来自系统网卡列表', '未检测'], ['适配器库', 'GitHub registry / 本地 custom', '可同步'], ['诊断原则', '不把 false 改成绿色', '真实状态']];

export function HomePage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  return <section className="page-stack"><div className="hero-panel"><div><span className="eyebrow">LAN HELPER</span><h2>先建立真实组网，再根据游戏能力选择转换方案</h2><p>联机助手不是普通 VPN 外壳，也不宣传“万能一键联机”。它会先判断游戏的联机能力，再选择虚拟局域网、专用服务端、广播桥、端口代理、Mod 或 Steam Relay 插件等路线。</p><div className="actions"><button onClick={() => onNavigate('scan')}>扫描本机游戏</button><button className="secondary" onClick={() => onNavigate('network')}>进入通用组网</button><button className="secondary" onClick={() => onNavigate('adapters')}>管理适配器</button></div></div><div className="hero-status-card"><div className="feature-card-title"><h3>真实状态总览</h3><span className="badge warn">待检测</span></div><div className="status-grid compact">{statusItems.map(([name, desc, state]) => <div className="status-tile" key={name}><span>{name}</span><strong>{state}</strong><small>{desc}</small></div>)}</div></div></div><div className="notice-card"><strong>产品边界：</strong>房间聊天已取消；保留“复制给朋友”的通用组网配置。任何绿色状态都必须来自真实检测，不能只改 UI。</div><div className="section-header"><div><span className="eyebrow">PLAYER FLOW</span><h3>普通玩家路径</h3><p className="muted">普通玩家不需要手写 JSON，按路径完成扫描、判断、组网和邀请。</p></div></div><div className="feature-grid">{playerPath.map(([step, title, desc]) => <article className="card mini-card" key={step}><span className="step-dot">{step}</span><h3>{title}</h3><p className="muted">{desc}</p></article>)}</div><div className="section-header"><div><span className="eyebrow">ARCHITECTURE</span><h3>产品分层</h3><p className="muted">把“能不能联机”拆成可扩展、可诊断、可复用的模块。</p></div></div><div className="feature-grid two">{productLayers.map(([title, desc]) => <article className="card" key={title}><h3>{title}</h3><p className="muted">{desc}</p></article>)}</div></section>;
}
