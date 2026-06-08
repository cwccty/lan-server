import type { NetworkConfig } from '../types/network';

export const LAN_INVITE_PACKET_HEADER = '[联机助手邀请包]';

export interface LanInvitePacket {
  gameName?: string;
  gameId?: string;
  hostVirtualIp?: string;
  friendVirtualIp?: string;
  friendName?: string;
  supernode?: string;
  roomName?: string;
  roomKey?: string;
  gamePort?: number;
  serverRunning?: boolean;
  friendCheck?: string;
}

export interface LanInviteValidationResult {
  ok: boolean;
  missing: string[];
}

function valueOf(line: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = line.match(new RegExp(`^\\s*${escaped}\\s*[：:]\\s*(.*?)\\s*$`));
  return match ? match[1].trim() : '';
}

function cleanUnknown(value?: string) {
  const text = (value || '').trim();
  if (!text || ['未读取', '未配置', '未选择', '未分配', '未读取到', '未知', '无', '-', 'null', 'undefined'].includes(text)) return '';
  return text;
}

function splitFriend(value: string) {
  const match = value.match(/^([^\s(]+)(?:\s*\((.+)\))?/);
  return {
    ip: cleanUnknown(match?.[1] || value),
    name: cleanUnknown(match?.[2] || '')
  };
}

export function parseLanInvitePacket(text: string): LanInvitePacket | null {
  if (!text.includes(LAN_INVITE_PACKET_HEADER) && !text.includes('联机助手真实邀请包')) return null;
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const packet: LanInvitePacket = {};
  for (const line of lines) {
    const gameName = valueOf(line, '游戏');
    if (gameName) packet.gameName = cleanUnknown(gameName) || undefined;
    const gameId = valueOf(line, '游戏 ID');
    if (gameId) packet.gameId = cleanUnknown(gameId) || undefined;
    const host = valueOf(line, '房主联机地址') || valueOf(line, '房主虚拟 IP');
    if (host) packet.hostVirtualIp = cleanUnknown(host) || undefined;
    const friend = valueOf(line, '好友预留地址') || valueOf(line, '好友预留 IP');
    if (friend) {
      const parsed = splitFriend(friend);
      packet.friendVirtualIp = parsed.ip || undefined;
      packet.friendName = parsed.name || undefined;
    }
    const supernode = valueOf(line, '中继地址') || valueOf(line, 'Supernode');
    if (supernode) packet.supernode = cleanUnknown(supernode) || undefined;
    const roomName = valueOf(line, '房间名');
    if (roomName) packet.roomName = cleanUnknown(roomName) || undefined;
    const roomKey = valueOf(line, '房间密钥');
    if (roomKey) packet.roomKey = cleanUnknown(roomKey) || undefined;
    const port = valueOf(line, '游戏端口');
    if (port) {
      const match = port.match(/\d{1,5}/);
      const number = match ? Number(match[0]) : NaN;
      if (Number.isFinite(number) && number > 0 && number <= 65535) packet.gamePort = number;
    }
    const server = valueOf(line, '服务端状态');
    if (server) packet.serverRunning = server.includes('运行');
    const check = valueOf(line, '好友检测');
    if (check) packet.friendCheck = cleanUnknown(check) || undefined;
  }
  // 只要有邀请包头，就返回结构体交给校验层做“缺少字段”分类。
  // 不要把“识别到邀请但字段缺失”退化成“无法识别”，否则用户无法复制结构化错误给房主。
  return packet;
}

export function validateLanInvitePacket(packet: LanInvitePacket): LanInviteValidationResult {
  const missing: string[] = [];
  if (!cleanUnknown(packet.supernode)) missing.push('中继地址');
  if (!cleanUnknown(packet.roomName)) missing.push('房间名');
  if (!cleanUnknown(packet.roomKey)) missing.push('房间密钥');
  if (!cleanUnknown(packet.friendVirtualIp)) missing.push('好友预留地址');
  if (!cleanUnknown(packet.hostVirtualIp)) missing.push('房主联机地址');
  if (!Number.isFinite(Number(packet.gamePort)) || Number(packet.gamePort) <= 0) missing.push('游戏端口');
  return {
    ok: missing.length === 0,
    missing
  };
}

export function formatLanInviteMissingFields(missing: string[]) {
  return missing.length ? missing.join('、') : '无';
}

export function buildLanInvitePacket(input: {
  gameName?: string;
  gameId?: string;
  n2n?: NetworkConfig | null;
  hostVirtualIp?: string;
  friendVirtualIp?: string;
  friendName?: string;
  port: number;
  serverRunning?: boolean;
  friendCheck?: string;
}) {
  const friend = input.friendVirtualIp ? `${input.friendVirtualIp}${input.friendName ? ` (${input.friendName})` : ''}` : '未分配';
  return [
    LAN_INVITE_PACKET_HEADER,
    `游戏：${input.gameName || '未选择'}`,
    `游戏 ID：${input.gameId || '未选择'}`,
    `房主联机地址：${input.hostVirtualIp || input.n2n?.local_ip || '未读取'}`,
    `好友预留地址：${friend}`,
    `中继地址：${input.n2n?.supernode || '未读取'}`,
    `房间名：${input.n2n?.room_name || '未读取'}`,
    `房间密钥：${input.n2n?.secret || '未读取'}`,
    `游戏端口：${input.port}`,
    `服务端状态：${input.serverRunning ? '运行中' : '未运行'}`,
    `好友检测：${input.friendCheck || '未检测'}`,
    '',
    '好友操作：打开联机助手，粘贴此邀请包，点击“保存并加入”，再在游戏内连接房主联机地址和端口。'
  ].join('\n');
}

export function invitePacketToNetworkConfig(packet: LanInvitePacket): NetworkConfig {
  return {
    room_name: packet.roomName || '',
    secret: packet.roomKey || '',
    supernode: packet.supernode || '',
    local_ip: packet.friendVirtualIp || ''
  };
}
