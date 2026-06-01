type Page = 'home' | 'wizard' | 'scan' | 'detail' | 'network' | 'recommendation' | 'diagnostics';

export function HomePage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  return (
    <section>
      <h2>让局域网游戏联机更简单</h2>
      <p>
        先完成通用组网，再按游戏需要选择是否使用一键开服向导。n2n、Radmin、已有局域网属于网络底座，
        Terraria 等游戏向导只是可选辅助，不会把组网能力绑定到单个游戏。
      </p>
      <div className="actions">
        <button onClick={() => onNavigate('network')}>打开通用组网中心</button>
        <button onClick={() => onNavigate('wizard')}>打开 Terraria 向导</button>
        <button onClick={() => onNavigate('scan')}>扫描本机游戏</button>
        <button onClick={() => onNavigate('diagnostics')}>查看诊断报告</button>
      </div>
    </section>
  );
}
