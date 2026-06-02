import { useEffect, useMemo, useState } from 'react';
import {
  exportGameAdapterJson,
  importGameAdapterJson,
  listGameAdapters,
  saveGameAdapter,
  syncAdapterRegistry,
  syncLocalAdapterRegistryExample,
  type AdapterRegistrySyncResult
} from '../api/tauri';
import type { ConversionMethod, GameAdapter, GameCapability, MultiplayerCapability } from '../types/game';

const capabilityOptions: Array<[MultiplayerCapability, string]> = [
  ['native_lan_ip', '原生 LAN/IP 直连'],
  ['hidden_dedicated_server', '隐藏/独立服务端'],
  ['lan_discovery_broadcast', '局域网广播发现'],
  ['tcp_udp_proxy_possible', '可尝试端口代理'],
  ['community_mod', '社区 Mod 联机'],
  ['official_only', '仅官方/平台联机'],
  ['unsupported', '暂不支持转换'],
  ['unknown', '未知，需人工适配']
];

const methodOptions: Array<[ConversionMethod, string]> = [
  ['virtual_lan', '虚拟局域网'],
  ['dedicated_server_launcher', '服务端启动器'],
  ['broadcast_bridge', '广播桥'],
  ['port_proxy', '端口代理'],
  ['mod_installer', 'Mod 安装器'],
  ['steam_relay_plugin', 'Steam Relay 插件'],
  ['manual_guide', '手动说明'],
  ['not_supported', '不支持']
];

const templates: Record<string, Pick<GameAdapter, 'capabilities' | 'default_ports' | 'multiplayer_conversion' | 'launch_profiles'>> = {
  native_lan_ip: {
    capabilities: ['lan', 'ip_join'],
    default_ports: [],
    launch_profiles: [{ id: 'docs', name: '查看连接说明', type: 'docs' }],
    multiplayer_conversion: {
      capability: 'native_lan_ip',
      methods: ['virtual_lan', 'manual_guide'],
      can_convert_to_lan: true,
      risk_level: 'low',
      notes: ['该游戏原生支持 LAN 或 IP 直连。', '联机助手负责组网、邀请信息和连通性诊断。'],
      required_components: ['n2n/Radmin/已有局域网', '游戏内 LAN/IP 加入']
    }
  },
  dedicated_server: {
    capabilities: ['lan', 'ip_join', 'dedicated_server'],
    default_ports: [],
    launch_profiles: [{ id: 'docs', name: '查看连接说明', type: 'docs' }],
    multiplayer_conversion: {
      capability: 'hidden_dedicated_server',
      methods: ['virtual_lan', 'dedicated_server_launcher', 'manual_guide'],
      can_convert_to_lan: true,
      risk_level: 'low',
      notes: ['该游戏支持独立服务端或可由服务端启动器承接。', '组网成功后，加入方连接房主虚拟 IP 和游戏端口。'],
      required_components: ['n2n/Radmin/已有局域网', '本地服务端', '游戏端口']
    }
  },
  official_only: {
    capabilities: ['official_server'],
    default_ports: [],
    launch_profiles: [{ id: 'docs', name: '查看连接说明', type: 'docs' }],
    multiplayer_conversion: {
      capability: 'official_only',
      methods: ['steam_relay_plugin', 'manual_guide'],
      can_convert_to_lan: false,
      risk_level: 'high',
      notes: ['该游戏当前只识别到官方/平台联机能力。', '不能承诺转换为本地联机；未来可研究平台网络插件。'],
      required_components: ['官方联机', '未来平台网络插件']
    }
  }
};

function emptyAdapter(): GameAdapter {
  return {
    game_id: '',
    display_name: '',
    steam_appid: undefined,
    capabilities: ['unknown'],
    executables: [],
    default_ports: [],
    launch_profiles: [{ id: 'docs', name: '查看连接说明', type: 'docs' }],
    multiplayer_conversion: {
      capability: 'unknown',
      methods: ['manual_guide'],
      can_convert_to_lan: false,
      risk_level: 'high',
      notes: ['需要管理员或高级用户进一步确认。'],
      required_components: ['人工适配']
    }
  };
}

function lines(value: string) {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function csv(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

export function AdapterManagerPage() {
  const [adapters, setAdapters] = useState<GameAdapter[]>([]);
  const [draft, setDraft] = useState<GameAdapter>(emptyAdapter());
  const [executablesText, setExecutablesText] = useState('');
  const [portsText, setPortsText] = useState('');
  const [notesText, setNotesText] = useState('需要管理员或高级用户进一步确认。');
  const [componentsText, setComponentsText] = useState('人工适配');
  const [importText, setImportText] = useState('');
  const [exportText, setExportText] = useState('');
  const [registryUrl, setRegistryUrl] = useState('');
  const [registryResult, setRegistryResult] = useState<AdapterRegistrySyncResult | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = () => listGameAdapters().then(setAdapters).catch((error) => setMessage(String(error)));

  useEffect(() => {
    refresh();
    setRegistryUrl(window.localStorage.getItem('lan-helper-adapter-registry-url') ?? '');
  }, []);

  const adapterCount = useMemo(() => adapters.length, [adapters]);

  const syncDraftText = (next: GameAdapter) => {
    setDraft(next);
    setExecutablesText(next.executables.join('\n'));
    setPortsText(next.default_ports.join(','));
    setNotesText(next.multiplayer_conversion?.notes.join('\n') ?? '');
    setComponentsText(next.multiplayer_conversion?.required_components.join('\n') ?? '');
  };

  const applyTemplate = (id: keyof typeof templates) => {
    const template = templates[id];
    syncDraftText({ ...draft, ...template, multiplayer_conversion: { ...template.multiplayer_conversion! } });
  };

  const save = async () => {
    setBusy(true);
    setMessage('');
    try {
      const next: GameAdapter = {
        ...draft,
        steam_appid: draft.steam_appid?.trim() || undefined,
        executables: lines(executablesText),
        default_ports: csv(portsText).map(Number).filter((item) => Number.isInteger(item) && item > 0),
        multiplayer_conversion: {
          ...(draft.multiplayer_conversion ?? emptyAdapter().multiplayer_conversion!),
          notes: lines(notesText),
          required_components: lines(componentsText)
        }
      };
      const saved = await saveGameAdapter(next);
      syncDraftText(saved);
      await refresh();
      setMessage(`已保存适配器：${saved.display_name}`);
    } catch (error) {
      setMessage(String(error));
    } finally {
      setBusy(false);
    }
  };

  const importAdapter = async () => {
    setBusy(true);
    setMessage('');
    try {
      const saved = await importGameAdapterJson(importText);
      syncDraftText(saved);
      setImportText('');
      await refresh();
      setMessage(`已导入适配器：${saved.display_name}`);
    } catch (error) {
      setMessage(String(error));
    } finally {
      setBusy(false);
    }
  };

  const exportAdapter = async (gameId: string) => {
    setBusy(true);
    setMessage('');
    try {
      setExportText(await exportGameAdapterJson(gameId));
      setMessage('已生成导出 JSON，可复制给管理员或其他用户。');
    } catch (error) {
      setMessage(String(error));
    } finally {
      setBusy(false);
    }
  };

  const syncRegistry = async () => {
    setBusy(true);
    setMessage('');
    setRegistryResult(null);
    try {
      window.localStorage.setItem('lan-helper-adapter-registry-url', registryUrl);
      const result = await syncAdapterRegistry(registryUrl);
      setRegistryResult(result);
      await refresh();
      setMessage(`共享库同步完成：更新 ${result.updated} 个，跳过 ${result.skipped} 个。`);
    } catch (error) {
      setMessage(String(error));
    } finally {
      setBusy(false);
    }
  };

  const syncLocalExample = async () => {
    setBusy(true);
    setMessage('');
    setRegistryResult(null);
    try {
      const result = await syncLocalAdapterRegistryExample();
      setRegistryResult(result);
      await refresh();
      setMessage(`本地示例库同步完成：更新 ${result.updated} 个，跳过 ${result.skipped} 个。`);
    } catch (error) {
      setMessage(String(error));
    } finally {
      setBusy(false);
    }
  };

  const conversion = draft.multiplayer_conversion ?? emptyAdapter().multiplayer_conversion!;

  return (
    <section>
      <h2>游戏适配器管理</h2>
      <p className="muted">这是管理员/高级功能：认定一次游戏类型并保存适配器，后续其他用户扫描到同一游戏即可复用转换方案。</p>
      {message && <div className="busy-banner">{message}</div>}

      <article className="card">
        <h3>远程共享适配器库</h3>
        <p className="muted">
          从管理员维护的 registry index 拉取适配器。远程适配器会保存为 registry_*.json；
          如果本地存在同 game_id 的 custom_*.json，本地自定义会优先。
        </p>
        <div className="actions">
          <button disabled={busy} onClick={syncLocalExample}>同步本地示例库（无需 HTTP）</button>
        </div>
        <p className="muted">
          如果只是测试项目内置的 adapter-registry 示例，优先点上面的按钮；只有测试 VPS / GitHub Pages / 本地 HTTP 服务时才需要填写 URL。
        </p>
        <label>Registry index URL
          <input
            value={registryUrl}
            onChange={(event) => setRegistryUrl(event.target.value)}
            placeholder="https://example.com/adapter-registry/index.json"
            disabled={busy}
          />
        </label>
        <button disabled={busy || !registryUrl.trim()} onClick={syncRegistry}>同步共享适配器库</button>
        {registryResult && (
          <div className={registryResult.ok ? 'result-ok' : 'result-bad'}>
            <h4>{registryResult.ok ? '同步成功' : '同步完成但有跳过项'}</h4>
            <p>更新：{registryResult.updated}，跳过：{registryResult.skipped}</p>
            <ul>
              {registryResult.messages.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        )}
      </article>

      <article className="card">
        <h3>当前适配器（{adapterCount}）</h3>
        {adapters.length === 0 ? <p className="muted">暂无适配器。</p> : (
          <table className="adapter-table">
            <thead><tr><th>游戏</th><th>AppID</th><th>能力</th><th>端口</th><th>操作</th></tr></thead>
            <tbody>
              {adapters.map((adapter) => (
                <tr key={adapter.game_id}>
                  <td>{adapter.display_name}<br /><small className="muted">{adapter.game_id}</small></td>
                  <td>{adapter.steam_appid || '-'}</td>
                  <td>{adapter.multiplayer_conversion?.capability || 'unknown'}</td>
                  <td>{adapter.default_ports.join(',') || '-'}</td>
                  <td>
                    <button disabled={busy} onClick={() => syncDraftText(adapter)}>编辑</button>
                    <button disabled={busy} onClick={() => exportAdapter(adapter.game_id)}>导出</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>

      <article className="card">
        <h3>新增 / 编辑适配器</h3>
        <div className="actions">
          <button disabled={busy} onClick={() => syncDraftText(emptyAdapter())}>新建空白</button>
          <button disabled={busy} onClick={() => applyTemplate('native_lan_ip')}>模板：原生 LAN/IP</button>
          <button disabled={busy} onClick={() => applyTemplate('dedicated_server')}>模板：Dedicated Server</button>
          <button disabled={busy} onClick={() => applyTemplate('official_only')}>模板：仅官方联机</button>
        </div>
        <label>游戏 ID<input value={draft.game_id} onChange={(event) => setDraft({ ...draft, game_id: event.target.value })} placeholder="例如 my_game" /></label>
        <label>显示名<input value={draft.display_name} onChange={(event) => setDraft({ ...draft, display_name: event.target.value })} /></label>
        <label>Steam AppID（可选）<input value={draft.steam_appid ?? ''} onChange={(event) => setDraft({ ...draft, steam_appid: event.target.value })} /></label>
        <label>可执行文件名，每行一个<textarea value={executablesText} onChange={(event) => setExecutablesText(event.target.value)} placeholder="Game.exe" /></label>
        <label>默认端口，逗号分隔<input value={portsText} onChange={(event) => setPortsText(event.target.value)} placeholder="7777,25565" /></label>
        <label>联机能力类型
          <select value={conversion.capability} onChange={(event) => setDraft({ ...draft, multiplayer_conversion: { ...conversion, capability: event.target.value as MultiplayerCapability } })}>
            {capabilityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>转换方式
          <select multiple value={conversion.methods} onChange={(event) => setDraft({ ...draft, multiplayer_conversion: { ...conversion, methods: Array.from(event.target.selectedOptions).map((item) => item.value as ConversionMethod) } })}>
            {methodOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <small className="muted">按住 Ctrl 可以多选。</small>
        </label>
        <label>是否可转换成本地联机
          <select value={String(conversion.can_convert_to_lan)} onChange={(event) => setDraft({ ...draft, multiplayer_conversion: { ...conversion, can_convert_to_lan: event.target.value === 'true' } })}>
            <option value="true">可转换</option>
            <option value="false">暂不承诺</option>
          </select>
        </label>
        <label>风险等级
          <select value={conversion.risk_level} onChange={(event) => setDraft({ ...draft, multiplayer_conversion: { ...conversion, risk_level: event.target.value as 'low' | 'medium' | 'high' } })}>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>
        </label>
        <label>所需组件，每行一个<textarea value={componentsText} onChange={(event) => setComponentsText(event.target.value)} /></label>
        <label>判断说明，每行一条<textarea value={notesText} onChange={(event) => setNotesText(event.target.value)} /></label>
        <button disabled={busy} onClick={save}>保存到本地适配器库</button>
      </article>

      <article className="card">
        <h3>导入 / 导出</h3>
        <label>导入适配器 JSON<textarea value={importText} onChange={(event) => setImportText(event.target.value)} placeholder="粘贴别人导出的适配器 JSON" /></label>
        <button disabled={busy || !importText.trim()} onClick={importAdapter}>导入并保存</button>
        <label>导出结果<textarea readOnly value={exportText} placeholder="点击上方表格中的导出按钮后，这里会出现 JSON。" /></label>
        <button disabled={!exportText} onClick={() => navigator.clipboard?.writeText(exportText)}>复制导出 JSON</button>
      </article>
    </section>
  );
}
