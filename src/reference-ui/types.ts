/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AppTab =
  | 'home'
  | 'solutions'
  | 'games'
  | 'protocol'
  | 'network'
  | 'advanced_tools'
  | 'terraria'
  | 'diagnostics'
  | 'settings';

export type NetworkStatus = 'idle' | 'testing' | 'ready' | 'connecting' | 'online' | 'warning';
export type NetworkBackendType = 'n2n' | 'radmin' | 'manual_lan';

export interface GameScan {
  id: string;
  name: string;
  coverUrl?: string;
  lastPlayed: string;
  status: 'ready' | 'needs_optimize' | 'unconfigured';
}

export interface SyncSolution {
  id: string;
  name: string;
  status: 'updated' | 'synced' | 'update_available';
  version: string;
  source: string;
}

export interface DiagnosticItem {
  id: string;
  name: string;
  status: 'normal' | 'error' | 'warning';
  detail: string;
}

export interface TimelineEvent {
  time: string;
  title: string;
  details: string;
  status: 'completed' | 'timeout' | 'success' | 'info';
}

export interface AppState {
  currentTab: AppTab;
  netStatus: NetworkStatus;
  role: 'host' | 'joiner';
  latency: number;
  packetLoss: number;
  localVirtualIp: string;
  friendVirtualIp: string;
  
  // Universal Network Inputs
  roomName: string;
  roomKey: string;
  supernode: string;
  virtualIpInput: string;
  gamePort: string;
  
  // Advanced options
  tcpProxy: boolean;
  udpProxy: boolean;
  udpBroadcastBridge: boolean;
  
  // Terraria Inputs
  terrariaWorld: string;
  terrariaPort: number;
  terrariaPasswordInput: string;
  terrariaMaxPlayers: number;
  terrariaRunning: boolean;
  terrariaLogs: string[];
  
  // Core Configuration Path
  edgePath: string;
  supernode_default: string;
  solutions_url: string;
}
