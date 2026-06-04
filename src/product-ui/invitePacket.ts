import type { NetworkConfig } from '../types/network';

export const LAN_INVITE_PACKET_HEADER = '[联机助手真实邀请包]';

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

function valueOf(line: string, label: string) {
  const prefix = `${label}：`;
  return line.startsWith(prefix) ? line.slice(prefix.length).trim() : '';
}

function cleanUnknown(value?: string) {
  const text = (value || '').trim();
  if (!text || ['未读取', '未配置', '未选择', '未分配', '未读取到'].includes(text)) return '';
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
  if (!text.includes(LAN_INVITE_PACKET_HEADER)) return null;
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const packet: LanInvitePacket = {};
  for (const line of lines) {
    const gameName = valueOf(line, '游戏');
    if (gameName) packet.gameName = cleanUnknown(gameName) || undefined;
    const gameId = valueOf(line, '游戏 ID');
    if (gameId) packet.gameId = cleanUnknown(gameId) || undefined;
    const host = valueOf(line, '房主虚拟 IP');
    if (host) packet.hostVirtualIp = cleanUnknown(host) || undefined;
    const friend = valueOf(line, '好友预留 IP');
    if (friend) {
      const parsed = splitFriend(friend);
      packet.friendVirtualIp = parsed.ip || undefined;
      packet.friendName = parsed.name || undefined;
    }
    const supernode = valueOf(line, 'Supernode');
    if (supernode) packet.supernode = cleanUnknown(supernode) || undefined;
    const roomName = valueOf(line, '房间名');
    if (roomName) packet.roomName = cleanUnknown(roomName) || undefined;
    const roomKey = valueOf(line, '房间密钥');
    if (roomKey) packet.roomKey = cleanUnknown(roomKey) || undefined;
    const port = valueOf(line, '游戏端口');
    if (port) {
      const number = Number(port.replace(/[^0-9]/g, ''));
      if (Number.isFinite(number) && number > 0) packet.gamePort = number;
    }
    const server = valueOf(line, '服务端状态');
    if (server) packet.serverRunning = server.includes('运行');
    const check = valueOf(line, '好友检测');
    if (check) packet.friendCheck = cleanUnknown(check) || undefined;
  }
  if (!packet.supernode && !packet.roomName && !packet.hostVirtualIp) return null;
  return packet;
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
    `房主虚拟 IP：${input.hostVirtualIp || input.n2n?.local_ip || '未读取'}`,
    `好友预留 IP：${friend}`,
    `Supernode：${input.n2n?.supernode || '未读取'}`,
    `房间名：${input.n2n?.room_name || '未读取'}`,
    `房间密钥：${input.n2n?.secret || '未读取'}`,
    `游戏端口：${input.port}`,
    `服务端状态：${input.serverRunning ? '运行中' : '未运行'}`,
    `好友检测：${input.friendCheck || '未检测'}`,
    '',
    '好友操作：打开联机助手，粘贴此邀请包，确认进入后启动 n2n，再在游戏内连接房主虚拟 IP 和端口。'
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
