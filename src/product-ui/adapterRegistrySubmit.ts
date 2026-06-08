import type { GameAdapter } from '../types/game';

export interface AdapterRegistrySubmitPackage {
  adapter: GameAdapter;
  fileName: string;
  adapterPath: string;
  adapterUrl: string;
  normalizedJson: string;
  sha256: string;
  indexEntry: {
    game_id: string;
    steam_appid: string | null;
    adapter_url: string;
    sha256: string;
  };
  indexEntryJson: string;
  githubSteps: string[];
  vpsSteps: string[];
  reviewChecklist: string[];
  guideText: string;
}

export function registryFileName(gameId: string) {
  const safe = gameId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `${safe || 'game'}.json`;
}

export async function sha256Hex(content: string) {
  const bytes = new TextEncoder().encode(content);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

type RegistryAdapterJson = GameAdapter & {
  adapter_version?: string | null;
  description?: string | null;
  adapter_source?: string | null;
};

function canonicalizeRegistryAdapter(parsed: RegistryAdapterJson): RegistryAdapterJson {
  const adapter: RegistryAdapterJson = {
    ...parsed,
    adapter_version: parsed.adapter_version?.trim() || '1.0.0',
    description: parsed.description?.trim() || parsed.connection_plan?.summary || `${parsed.display_name} 联机方案适配器。`,
  };
  delete adapter.adapter_source;
  return adapter;
}

function normalizeAdapterJson(adapterJson: string) {
  const parsed = JSON.parse(adapterJson) as RegistryAdapterJson;
  return `${JSON.stringify(canonicalizeRegistryAdapter(parsed), null, 2)}\n`;
}

export async function buildAdapterRegistrySubmitPackage(
  adapterJson: string,
  registryUrl = 'https://raw.githubusercontent.com/cwccty/lan-server/master/adapter-registry/index.json'
): Promise<AdapterRegistrySubmitPackage> {
  const normalizedJson = normalizeAdapterJson(adapterJson);
  const adapter = JSON.parse(normalizedJson) as GameAdapter;
  const fileName = registryFileName(adapter.game_id);
  const adapterPath = `adapter-registry/games/${fileName}`;
  const adapterUrl = `games/${fileName}`;
  const sha256 = await sha256Hex(normalizedJson);
  const indexEntry = {
    game_id: adapter.game_id,
    steam_appid: adapter.steam_appid ?? null,
    adapter_url: adapterUrl,
    sha256
  };
  const indexEntryJson = JSON.stringify(indexEntry, null, 2);
  const githubSteps = [
    `保存 adapter JSON 到 ${adapterPath}`,
    '打开 adapter-registry/index.json，在 games 数组中新增或替换同 game_id 条目。',
    '确认 sha256 与当前提交包一致。',
    '提交并 push 到 GitHub；如果仓库启用了 GitHub Pages，等待页面刷新。',
    `客户端使用共享库地址同步：${registryUrl || '你的 adapter-registry/index.json URL'}`
  ];
  const vpsSteps = [
    `把 JSON 上传到 VPS 的静态目录：${adapterPath}`,
    '修改同目录下 adapter-registry/index.json 的 games 数组。',
    '确认 Web 服务器能访问 index.json 和 games/*.json。',
    '在客户端方案库中填写你的 VPS index.json URL 后同步。',
  ];
  const reviewChecklist = [
    'game_id、display_name、Steam AppID、exe 特征准确。',
    'network_type 与实际多人能力一致，没有把同屏游戏误写成 LAN。',
    'connection_plan 的房主/加入者步骤可复现。',
    'applicability 已填写测试版本、平台、系统、网络条件和不适用边界。',
    'evidence 已填写端口协议、截图/日志/实测步骤和最近验证时间。',
    '端口、广播桥、服务端需求已人工验证或明确标注待确认。',
    '不包含下载未知 exe、绕过正版验证、绕过反作弊或模拟官方账号服务的内容。'
  ];
  const guideText = [
    '【联机助手共享适配器提交包】',
    '',
    `游戏：${adapter.display_name} (${adapter.game_id})`,
    `适配器文件：${adapterPath}`,
    `adapter_url：${adapterUrl}`,
    `SHA256：${sha256}`,
    '',
    'index.json 条目：',
    indexEntryJson,
    '',
    'GitHub Pages 提交流程：',
    ...githubSteps.map((step, index) => `${index + 1}. ${step}`),
    '',
    'VPS / 静态服务器流程：',
    ...vpsSteps.map((step, index) => `${index + 1}. ${step}`),
    '',
    '审核清单：',
    ...reviewChecklist.map((item) => `- ${item}`)
  ].join('\n');

  return {
    adapter,
    fileName,
    adapterPath,
    adapterUrl,
    normalizedJson,
    sha256,
    indexEntry,
    indexEntryJson,
    githubSteps,
    vpsSteps,
    reviewChecklist,
    guideText
  };
}
