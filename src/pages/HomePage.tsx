type Page = 'home' | 'scan' | 'detail' | 'network' | 'recommendation' | 'diagnostics';

export function HomePage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  return (
    <section>
      <h2>让小型游戏联机更简单</h2>
      <p>自动检测游戏能力、网络状态和可行方案。</p>
      <div className="actions">
        <button onClick={() => onNavigate('scan')}>扫描本机游戏</button>
        <button onClick={() => onNavigate('scan')}>手动添加游戏</button>
        <button onClick={() => onNavigate('network')}>网络环境检测</button>
        <button onClick={() => onNavigate('diagnostics')}>查看诊断报告</button>
      </div>
    </section>
  );
}
