import { useEffect, useRef, useState } from 'react';
import {
  analyzeReferenceGameByName,
  exportReferenceAdapterJson,
  generateReferenceDiagnostics,
  importReferenceAdapterJson,
  launchReferenceProfile,
  readReferenceN2nLastConfig,
  readReferenceTerrariaServer,
  refreshReferenceAdapterInventory,
  refreshReferenceRuntime,
  saveReferenceAppSettings,
  saveReferenceN2nConfig,
  saveReferenceAdapterDraft,
  scanReferenceGames,
  sendReferenceTerrariaCommand,
  selfTestReferenceAdvancedProxy,
  startReferenceAdvancedProxy,
  startReferenceGenericServer,
  startReferenceN2n,
  startReferenceTerrariaServer,
  stopReferenceAdvancedProxy,
  stopReferenceN2n,
  stopReferenceTerrariaServer,
  syncReferenceAdapterRegistry,
  syncReferenceLocalAdapterRegistry,
  testReferenceEdgePath,
  testReferenceConnectivity,
  type ReferenceActionResult
} from './actions';
import type { NetworkConfig } from '../types/network';
import type { LaunchConfig } from '../types/recommendation';
import type { AppSettings } from '../types/settings';
import {
  getReferenceSelectedFriend,
  removeReferenceFriendAllocationBackendFirst,
  selectReferenceFriendAllocationBackendFirst,
  updateReferenceFriendCheckBackendFirst,
  upsertReferenceFriendAllocationBackendFirst
} from './friendAllocations';
import type { AdapterRegistrySyncResult } from '../api/tauri';
import { requestReferenceAdapterInventoryRefresh, setReferenceAdapterSyncResult } from './adapterSyncResult';
import { getReferenceSelectedGame } from './selectedGame';
import { useReferenceProductMode } from './useReferenceProductMode';

const BUSY_ATTR = 'data-lan-helper-product-busy';
const HOOK_ATTR = 'data-lan-helper-action-hooked';

function textOf(element: Element) {
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function isVisible(element: Element) {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
}

function findPageRoot(headingText: string) {
  const headings = Array.from(document.querySelectorAll<HTMLElement>('main h1, main h2, main h3')).filter((heading) => {
    return textOf(heading).includes(headingText) && isVisible(heading);
  });
  const heading = headings.length > 0 ? headings[headings.length - 1] : null;
  const root = heading?.closest('.space-y-6') ?? heading?.closest('main > div > div') ?? null;
  if (root?.querySelector('[data-lan-helper-product-controlled]') || (root as HTMLElement | null)?.dataset?.lanHelperProductControlled) {
    return null;
  }
  return root;
}

function firstButton(text: string, headingText: string) {
  const root = findPageRoot(headingText);
  if (!root) return null;
  return Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((button) => {
    return textOf(button).includes(text) && isVisible(button);
  }) ?? null;
}

function buttonsByText(text: string, headingText: string) {
  const root = findPageRoot(headingText);
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLButtonElement>('button')).filter((button) => {
    return textOf(button).includes(text) && isVisible(button);
  });
}

function findInputByLabel(labelText: string) {
  const labels = Array.from(document.querySelectorAll('label'));
  const label = labels.find((item) => textOf(item).includes(labelText));
  const container = label?.parentElement;
  return container?.querySelector('input, textarea, select') as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
}

function readNetworkConfigFromReferenceForm(): NetworkConfig {
  const roomName = findInputByLabel('Room Name')?.value?.trim();
  const secret = findInputByLabel('Key')?.value?.trim();
  const supernode = findInputByLabel('Supernode')?.value?.trim();
  const localIp = findInputByLabel('Virtual IP')?.value?.trim();

  return {
    room_name: roomName || undefined,
    secret: secret || undefined,
    supernode: supernode || undefined,
    local_ip: localIp || undefined
  };
}

function readTerrariaConfigFromReferenceForm(): LaunchConfig {
  const world = findInputByLabel('选择要开启的世界地图')?.value?.trim();
  const portValue = findInputByLabel('服务物理端口')?.value;
  const password = findInputByLabel('进入加密锁')?.value ?? '';
  const maxPlayersValue = findInputByLabel('最大玩家承载额')?.value;
  const port = Number(portValue || 7777);
  const maxPlayers = Number(maxPlayersValue || 8);

  return {
    ...(world ? { world } : {}),
    port: Number.isFinite(port) ? port : 7777,
    password,
    max_players: Number.isFinite(maxPlayers) ? maxPlayers : 8
  };
}

function readSolutionsRegistryUrl() {
  const root = findPageRoot('方案库');
  const input = root?.querySelector('input[type="text"]') as HTMLInputElement | null;
  return input?.value?.trim() || 'http://127.0.0.1:5173/adapter-registry/index.json';
}

function chooseJsonFile() {
  return new Promise<string>((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    input.onchange = () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) {
        reject(new Error('没有选择要导入的 JSON 文件。'));
        return;
      }
      file.text().then(resolve).catch((error) => reject(error instanceof Error ? error : new Error(String(error))));
    };
    document.body.appendChild(input);
    input.click();
  });
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function importReferenceAdapterFromFile() {
  try {
    const content = await chooseJsonFile();
    return importReferenceAdapterJson(content);
  } catch (error) {
    return {
      ok: false,
      action: '导入共享游戏方案 JSON',
      message: error instanceof Error ? error.message : String(error || '导入失败')
    } satisfies ReferenceActionResult;
  }
}

async function exportReferenceAdapterToFile() {
  const selectedGame = getReferenceSelectedGame();
  const result = await exportReferenceAdapterJson(selectedGame?.game_id);
  if (result.ok && result.data && typeof result.data === 'object') {
    const data = result.data as { game_id?: string; content?: string };
    if (data.content) {
      downloadTextFile(`lan-helper-adapter-${data.game_id || 'game'}.json`, data.content);
    }
  }
  return result;
}

function isAdapterRegistrySyncResult(value: unknown): value is AdapterRegistrySyncResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as Partial<AdapterRegistrySyncResult>;
  return typeof result.ok === 'boolean'
    && typeof result.total === 'number'
    && Array.isArray(result.items);
}

async function syncReferenceAdapterRegistryAndStore() {
  const result = await syncReferenceAdapterRegistry(readSolutionsRegistryUrl());
  if (result.ok && isAdapterRegistrySyncResult(result.data)) {
    setReferenceAdapterSyncResult('remote', result.data);
  }
  return result;
}

async function syncReferenceLocalAdapterRegistryAndStore() {
  const result = await syncReferenceLocalAdapterRegistry();
  if (result.ok && isAdapterRegistrySyncResult(result.data)) {
    setReferenceAdapterSyncResult('local', result.data);
  }
  return result;
}

async function refreshReferenceAdapterInventoryAndPanel() {
  const result = await refreshReferenceAdapterInventory();
  requestReferenceAdapterInventoryRefresh('manual-cache-refresh');
  if (result.ok) {
    return {
      ...result,
      message: '已重新读取本地真实方案列表。该动作不会访问远程 registry，也不会写入/覆盖 adapter；如需同步远程，请使用“一键更新共享方案”。'
    };
  }
  return result;
}

function readHostIpFromRecommendationPage() {
  const root = findPageRoot('推荐方案');
  const text = root?.textContent ?? '';
  const match = text.match(/10\.\d+\.\d+\.\d+/);
  return match?.[0] ?? '10.0.8.1';
}

function readGamePortFromNetworkForm() {
  const value = findInputByLabel('Game Port')?.value;
  const port = Number(value || 7777);
  return Number.isFinite(port) ? port : 7777;
}

function findInputByPlaceholder(placeholderPart: string) {
  return Array.from(document.querySelectorAll<HTMLInputElement>('input')).find((item) =>
    (item.placeholder ?? '').includes(placeholderPart)
  ) ?? null;
}

function readFriendAllocationForm() {
  return {
    name: findInputByPlaceholder('隔壁老王')?.value?.trim() || '',
    ip: findInputByPlaceholder('10.0.8.5')?.value?.trim() || ''
  };
}

function closestGameNameFromButton(button: HTMLButtonElement) {
  const card = button.closest('article, [class*="rounded-2xl"]');
  const heading = card?.querySelector('h3, h4');
  return heading ? textOf(heading) : undefined;
}

function closestFriendFromButton(button: HTMLButtonElement) {
  const row = button.closest('div[class*="p-3"], div[class*="flex"]');
  const text = textOf(row ?? button);
  const ip = text.match(/10\.\d+\.\d+\.\d+/)?.[0] || '';
  const name =
    row?.querySelector('span.font-bold, strong, span')?.textContent?.trim()
    || text.replace(/预留 IPv4:.*/u, '').replace(/活跃在线|握手自测|就绪等待|生成邀请包|生存邀请包|回收席位/g, '').trim();
  return { name, ip };
}

function createLocalActionResult<T>(action: string, data: T, message: string): ReferenceActionResult<T> {
  return { ok: true, action, data, message };
}

function createLocalActionError(action: string, error: unknown): ReferenceActionResult {
  return {
    ok: false,
    action,
    message: error instanceof Error ? error.message : String(error || '操作失败')
  };
}

async function reserveReferenceFriendFromForm(): Promise<ReferenceActionResult> {
  try {
    const form = readFriendAllocationForm();
    const friend = await upsertReferenceFriendAllocationBackendFirst(form.name, form.ip);
    return createLocalActionResult('保存好友虚拟 IP 席位', friend, `已保存 ${friend.name} -> ${friend.ip}，并设为当前邀请对象。`);
  } catch (error) {
    return createLocalActionError('保存好友虚拟 IP 席位', error);
  }
}

async function selectReferenceFriendFromButton(button: HTMLButtonElement): Promise<ReferenceActionResult> {
  try {
    const friendInfo = closestFriendFromButton(button);
    const friend = await selectReferenceFriendAllocationBackendFirst(friendInfo.name, friendInfo.ip);
    return createLocalActionResult('选择好友邀请对象', friend, `当前邀请对象：${friend.name} (${friend.ip})。`);
  } catch (error) {
    return createLocalActionError('选择好友邀请对象', error);
  }
}

async function removeReferenceFriendFromButton(button: HTMLButtonElement): Promise<ReferenceActionResult> {
  try {
    const friendInfo = closestFriendFromButton(button);
    const friend = await removeReferenceFriendAllocationBackendFirst(friendInfo.name, friendInfo.ip);
    return createLocalActionResult('回收好友虚拟 IP 席位', friend, `已回收 ${friend.name} (${friend.ip})。`);
  } catch (error) {
    return createLocalActionError('回收好友虚拟 IP 席位', error);
  }
}

async function testSelectedReferenceFriend() {
  const friend = getReferenceSelectedFriend();
  if (!friend) return createLocalActionError('检测好友连接', new Error('请先分配或选择一个好友席位。'));
  const port = readGamePortFromNetworkForm();
  const result = await testReferenceConnectivity({ host: friend.ip, ports: [port], timeout_ms: 1200, mode: 'n2n_game_port' });
  const reachable = Boolean((result.data as any)?.reachable);
  const summary = reachable ? `端口 ${port} 有响应` : `端口 ${port} 未检测到响应，可能好友不是服务端或尚未启动游戏`;
  await updateReferenceFriendCheckBackendFirst(friend.ip, summary);
  return {
    ...result,
    action: '检测好友连接',
    message: `${friend.name} (${friend.ip})：${summary}`
  };
}

async function copyReferenceInvitePackage() {
  const selectedGame = getReferenceSelectedGame();
  const friend = getReferenceSelectedFriend();
  const n2nResult = await readReferenceN2nLastConfig();
  const config = n2nResult.ok ? n2nResult.data as NetworkConfig : undefined;
  const port = readGamePortFromNetworkForm();
  const invite = [
    '[联机助手真实邀请包]',
    `游戏: ${selectedGame?.display_name || '未选择'}`,
    `房主虚拟 IP: ${config?.local_ip || '未读取'}`,
    friend ? `好友预留 IP: ${friend.ip} (${friend.name})` : '好友预留 IP: 未分配',
    `Supernode: ${config?.supernode || '未读取'}`,
    `房间名: ${config?.room_name || '未读取'}`,
    `游戏端口: ${port}`,
    `好友检测: ${friend?.last_check_summary || '未检测'}`,
    '使用说明: 好友进入同一虚拟局域网后，在游戏内连接房主虚拟 IP 与上述端口。'
  ].join('\n');

  if (!navigator.clipboard) {
    throw new Error('当前环境不支持剪贴板写入，请从结果面板手动复制真实邀请包。');
  }
  await navigator.clipboard.writeText(invite);
  return createLocalActionResult('复制真实邀请包', { invite, friend, n2n: config }, '真实邀请包已按最近 n2n 配置、选中游戏和好友席位生成。');
}

function readRecommendationLaunchForm() {
  const root = findPageRoot('推荐方案');
  const select = root?.querySelector('select') as HTMLSelectElement | null;
  const selected = select?.value || 'terraria';
  const selectedGame = getReferenceSelectedGame();
  const gameMap: Record<string, string> = {
    terraria: 'terraria',
    minecraft: 'minecraft_java',
    palworld: 'palworld'
  };
  const gameId = selectedGame?.game_id || gameMap[selected] || selected;
  const profileId = gameId === 'minecraft_java' ? 'docs' : 'client';
  const maxPlayersValue = Array.from(root?.querySelectorAll<HTMLSelectElement>('select') ?? [])
    .find((item) => Array.from(item.options).some((option) => option.value === '8' || option.value === '16'))?.value;
  return {
    game_id: gameId,
    profile_id: profileId,
    config: {
      max_players: Number(maxPlayersValue || 8),
      port: readGamePortFromNetworkForm()
    }
  };
}

function readAdapterDraftForm() {
  const name = findInputByLabel('游戏及方案名称')?.value?.trim() || 'Custom Game';
  const steamAppId = findInputByLabel('Steam 专属 AppID')?.value?.trim();
  const executable = findInputByLabel('可执行程序拦截特征')?.value?.trim();
  const conversionProfile = findInputByLabel('网络转换模式')?.value;
  const portValue = findInputByLabel('游戏运行默认端口')?.value;
  const defaultJoinIp = findInputByLabel('客户端默认加入地址')?.value?.trim();
  const hostRole = findInputByLabel('房主/服务端配置行为指南')?.value;
  const joinRole = findInputByLabel('加入端/客机配置行为指南')?.value;
  const inviteTemplate = findInputByLabel('特邀邀请密信排版模板')?.value;
  const port = Number(portValue || 7777);
  return {
    name,
    steam_appid: steamAppId,
    executable,
    port: Number.isFinite(port) ? port : 7777,
    conversion_profile: conversionProfile,
    host_role: hostRole,
    join_role: joinRole,
    default_join_ip: defaultJoinIp,
    invite_template: inviteTemplate
  };
}

function readSettingsForm(): AppSettings {
  const edgePath = findInputByLabel('edge.exe 物理执行路径')?.value?.trim();
  const supernodeDefault = findInputByLabel('辅助 Supernode 公网候选组')?.value?.trim();
  return {
    edge_path: edgePath || null,
    supernode_default: supernodeDefault || null,
    adapter_registry_url: readSolutionsRegistryUrl(),
    product_mode: window.localStorage.getItem('lan-helper.referenceProductMode') === '1',
    log_dir: null,
    tools_dir: null,
    updated_at: new Date().toISOString()
  };
}

function readSettingsEdgePath() {
  return findInputByLabel('edge.exe 物理执行路径')?.value?.trim() || null;
}

function setBusy(button: HTMLButtonElement, busy: boolean, label?: string) {
  if (!button.dataset.lanHelperOriginalText) {
    button.dataset.lanHelperOriginalText = textOf(button);
  }
  if (!button.dataset.lanHelperOriginalTitle) {
    button.dataset.lanHelperOriginalTitle = button.title || '';
  }

  if (busy) {
    button.setAttribute(BUSY_ATTR, '1');
    button.disabled = true;
    if (label) button.title = label;
  } else {
    button.removeAttribute(BUSY_ATTR);
    button.disabled = false;
    button.title = button.dataset.lanHelperOriginalTitle || '';
  }
}

function dispatchProductNotice(actionId: string, result: ReferenceActionResult) {
  window.dispatchEvent(new CustomEvent('lan-helper:reference-product-action', { detail: { actionId, result, at: new Date().toISOString() } }));
}

function interceptButton(
  button: HTMLButtonElement | null,
  actionId: string,
  handler: (button: HTMLButtonElement) => Promise<ReferenceActionResult>
) {
  if (!button) return () => undefined;
  button.setAttribute(HOOK_ATTR, actionId);

  const handleClick = async (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (button.getAttribute(BUSY_ATTR) === '1') return;

    setBusy(button, true, '正在调用真实后端...');
    try {
      const result = await handler(button);
      dispatchProductNotice(actionId, result);
    } finally {
      setBusy(button, false);
    }
  };

  button.addEventListener('click', handleClick, true);
  return () => {
    button.removeEventListener('click', handleClick, true);
    button.removeAttribute(HOOK_ATTR);
    button.removeAttribute(BUSY_ATTR);
    button.disabled = false;
    if (button.dataset.lanHelperOriginalTitle !== undefined) {
      button.title = button.dataset.lanHelperOriginalTitle;
    }
  };
}

function useProductActionToast() {
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(''), 3200);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    const handleAction = (event: Event) => {
      const custom = event as CustomEvent<{ result?: ReferenceActionResult } | ReferenceActionResult>;
      const detail = custom.detail;
      const result: ReferenceActionResult | undefined =
        detail && 'ok' in detail ? detail : detail?.result;
      if (!result) return;
      setMessage(`${result.ok ? '真实后端完成' : '真实后端失败'}：${result.action}｜${result.message}`);
    };
    window.addEventListener('lan-helper:reference-product-action', handleAction as EventListener);
    return () => window.removeEventListener('lan-helper:reference-product-action', handleAction as EventListener);
  }, []);

  return message;
}

function readAdvancedProxyForm() {
  const root = findPageRoot('高级连接工具');
  const select = root?.querySelector('select') as HTMLSelectElement | null;
  const type = (select?.value === 'udp' || select?.value === 'bridge' ? select.value : 'tcp') as 'tcp' | 'udp' | 'bridge';
  const listenValue =
    findInputByLabel('本地端监听')?.value ||
    findInputByLabel('接收广播帧本地监听')?.value ||
    '7777';
  const targetHost = findInputByLabel('对端目的地 IPv4')?.value?.trim() || '10.0.8.2';
  const targetPortValue = findInputByLabel('对端目标游戏映射端口')?.value || listenValue;
  const listenPort = Number(listenValue);
  const targetPort = Number(targetPortValue);
  return {
    type,
    listen_port: Number.isFinite(listenPort) ? listenPort : 7777,
    target_host: type === 'bridge' ? targetHost || '10.0.8.255' : targetHost,
    target_port: Number.isFinite(targetPort) ? targetPort : undefined
  };
}

function readGenericServerForm() {
  const gameName = findInputByLabel('拟承载的联机游戏名')?.value?.trim() || '通用游戏服务端';
  const path = findInputByLabel('服务端物理 Jar/Exe 可执行路径')?.value?.trim() || '';
  const portValue = findInputByLabel('运行服务绑定端口')?.value || '7777';
  const port = Number(portValue);
  return {
    game_name: gameName,
    executable_path: path,
    port: Number.isFinite(port) ? port : 7777
  };
}

function readGenericServerCommand() {
  const root = findPageRoot('高级连接工具');
  const input = Array.from(root?.querySelectorAll<HTMLInputElement>('input') ?? []).find((item) =>
    (item.placeholder ?? '').includes('发送') || (item.placeholder ?? '').includes('指令')
  );
  return input?.value?.trim() || '';
}

function advancedProxyTypeFromButton(button: HTMLButtonElement): 'tcp' | 'udp' | 'bridge' {
  const card = button.closest('div[class*="rounded-2xl"]');
  const text = textOf(card ?? button);
  if (text.includes('BroadcastBridge') || text.includes('广播') || text.includes('BRIDGE')) return 'bridge';
  if (text.includes('UDP')) return 'udp';
  return 'tcp';
}

function useAttachProductActions(enabled: boolean) {
  const cleanupRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    cleanupRef.current.forEach((cleanup) => cleanup());
    cleanupRef.current = [];

    if (!enabled) return;

    const attach = () => {
      cleanupRef.current.forEach((cleanup) => cleanup());
      cleanupRef.current = [
        interceptButton(firstButton('保存基础参数', '通用组网中心'), 'network-save-config', () => saveReferenceN2nConfig(readNetworkConfigFromReferenceForm())),
        interceptButton(firstButton('Start n2n Edge', '通用组网中心'), 'network-start-n2n', () => startReferenceN2n(readNetworkConfigFromReferenceForm())),
        interceptButton(firstButton('Stop n2n Edge', '通用组网中心'), 'network-stop-n2n', () => stopReferenceN2n()),
        interceptButton(firstButton('Refresh Node Status', '通用组网中心'), 'network-refresh-runtime', () => refreshReferenceRuntime(false)),
        interceptButton(firstButton('启动自建服务', 'Terraria 联机向导'), 'terraria-start-server', () => startReferenceTerrariaServer(readTerrariaConfigFromReferenceForm())),
        interceptButton(firstButton('停止服务', 'Terraria 联机向导'), 'terraria-stop-server', () => stopReferenceTerrariaServer()),
        interceptButton(firstButton('一键自检', 'Terraria 联机向导'), 'terraria-read-server', () => readReferenceTerrariaServer()),
        interceptButton(firstButton('保存本地设置', '设置与帮助'), 'settings-save-app-settings', () => saveReferenceAppSettings(readSettingsForm())),
        interceptButton(firstButton('联机自测', '设置与帮助'), 'settings-test-edge-path', () => testReferenceEdgePath(readSettingsEdgePath())),
        interceptButton(firstButton('手动强制重扫', '网络诊断与链路性能'), 'diagnostics-generate', () => generateReferenceDiagnostics(getReferenceSelectedGame()?.game_id)),
        interceptButton(firstButton('手动重扫以刷新缓存', '游戏扫描'), 'games-scan-local', () => scanReferenceGames()),
        interceptButton(firstButton('强同步 Steam 自适应映射', '游戏扫描'), 'games-scan-steam-cache', () => scanReferenceGames()),
        interceptButton(firstButton('一键更新共享方案', '方案库'), 'solutions-sync-remote', () => syncReferenceAdapterRegistryAndStore()),
        interceptButton(firstButton('恢复默认', '方案库'), 'solutions-read-local-example', () => syncReferenceLocalAdapterRegistryAndStore()),
        ...buttonsByText('手动强制刷新', '方案库').map((button, index) =>
          interceptButton(button, `solutions-refresh-local-cache-${index}`, () => refreshReferenceAdapterInventoryAndPanel())
        ),
        ...buttonsByText('手动刷新此缓存', '方案库').map((button, index) =>
          interceptButton(button, `solutions-refresh-cache-link-${index}`, () => refreshReferenceAdapterInventoryAndPanel())
        ),
        interceptButton(firstButton('导入方案', '方案库'), 'solutions-import-adapter-json', () => importReferenceAdapterFromFile()),
        interceptButton(firstButton('导出备份', '方案库'), 'solutions-export-adapter-json', () => exportReferenceAdapterToFile()),
        interceptButton(firstButton('重新测试', '推荐方案'), 'recommendation-test-connectivity', () => testReferenceConnectivity({ host: readHostIpFromRecommendationPage(), ports: [readGamePortFromNetworkForm()], timeout_ms: 1200, mode: 'n2n_game_port' })),
        interceptButton(firstButton('复制主IP', '推荐方案'), 'recommendation-read-n2n-config', () => readReferenceN2nLastConfig()),
        interceptButton(firstButton('一键拷制专属密信包', '推荐方案'), 'recommendation-generate-diagnostics', () => generateReferenceDiagnostics(getReferenceSelectedGame()?.game_id)),
        interceptButton(firstButton('立即启动本地游戏实体', '推荐方案'), 'recommendation-launch-profile', () => launchReferenceProfile(readRecommendationLaunchForm())),
        interceptButton(firstButton('分配并生成推荐信', '推荐方案'), 'recommendation-reserve-friend-ip', () => Promise.resolve(reserveReferenceFriendFromForm())),
        ...buttonsByText('生存邀请包', '推荐方案').map((button) => interceptButton(button, 'recommendation-select-friend-invite', (target) => Promise.resolve(selectReferenceFriendFromButton(target)))),
        ...buttonsByText('生成邀请包', '推荐方案').map((button) => interceptButton(button, 'recommendation-select-friend-invite', (target) => Promise.resolve(selectReferenceFriendFromButton(target)))),
        ...buttonsByText('回收席位', '推荐方案').map((button) => interceptButton(button, 'recommendation-remove-friend-ip', (target) => Promise.resolve(removeReferenceFriendFromButton(target)))),
        interceptButton(firstButton('探测', '推荐方案'), 'recommendation-test-selected-friend', () => testSelectedReferenceFriend()),
        interceptButton(firstButton('复制完整邀请凭证包', '推荐方案'), 'recommendation-copy-real-invite', () => copyReferenceInvitePackage()),
        interceptButton(firstButton('查看分析与推荐方案', '游戏扫描'), 'games-analyze-selected', (button) => analyzeReferenceGameByName(closestGameNameFromButton(button))),
        interceptButton(firstButton('查看推荐配置方案', '游戏扫描'), 'games-analyze-modal-selected', (button) => analyzeReferenceGameByName(closestGameNameFromButton(button))),
        interceptButton(firstButton('创建局域网组网草稿', '游戏扫描'), 'games-create-draft-analysis', (button) => analyzeReferenceGameByName(closestGameNameFromButton(button))),
        interceptButton(firstButton('创建网络方案', '游戏扫描'), 'games-create-network-scheme', (button) => analyzeReferenceGameByName(closestGameNameFromButton(button))),
        interceptButton(firstButton('一键发布登记至共享适配器库', '方案库'), 'solutions-save-adapter-draft', () => saveReferenceAdapterDraft(readAdapterDraftForm())),
        interceptButton(firstButton('挂载并上线该高速链路', '高级连接工具'), 'advanced-start-proxy', () => startReferenceAdvancedProxy(readAdvancedProxyForm())),
        interceptButton(firstButton('一键连通自测', '高级连接工具'), 'advanced-self-test-proxy', (button) => selfTestReferenceAdvancedProxy(advancedProxyTypeFromButton(button))),
        interceptButton(firstButton('暂停代理', '高级连接工具'), 'advanced-stop-proxy', (button) => stopReferenceAdvancedProxy(advancedProxyTypeFromButton(button))),
        interceptButton(firstButton('完全卸载链路', '高级连接工具'), 'advanced-delete-proxy', (button) => stopReferenceAdvancedProxy(advancedProxyTypeFromButton(button))),
        interceptButton(firstButton('挂载并运行专属服务端', '高级连接工具'), 'advanced-start-generic-server', () => startReferenceGenericServer(readGenericServerForm())),
        interceptButton(firstButton('安全停止并固化世界存档', '高级连接工具'), 'advanced-stop-generic-server', () => stopReferenceTerrariaServer()),
        interceptButton(firstButton('发送指令', '高级连接工具'), 'advanced-send-generic-server-command', () => sendReferenceTerrariaCommand(readGenericServerCommand()))
      ].filter(Boolean) as Array<() => void>;
    };

    attach();
    const observer = new MutationObserver(() => attach());
    const main = document.querySelector('main') ?? document.body;
    observer.observe(main, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      cleanupRef.current.forEach((cleanup) => cleanup());
      cleanupRef.current = [];
    };
  }, [enabled]);
}

export function ReferenceProductActionPatcher() {
  const productMode = useReferenceProductMode();
  const actionMessage = useProductActionToast();
  useAttachProductActions(productMode.enabled);

  if (!productMode.enabled || !actionMessage) return null;

  return (
    <div className="fixed bottom-24 right-6 z-[650] max-w-md rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-xs text-white shadow-2xl">
      <div className="mb-1 font-semibold text-amber-300">Product Mode 真实动作</div>
      <div className="leading-relaxed text-slate-200">{actionMessage}</div>
    </div>
  );
}
