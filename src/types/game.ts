export type GameCapability =
  | 'lan'
  | 'ip_join'
  | 'dedicated_server'
  | 'steam_lobby'
  | 'steam_p2p'
  | 'official_server'
  | 'unknown';

export type MultiplayerCapability =
  | 'native_lan_ip'
  | 'hidden_dedicated_server'
  | 'lan_discovery_broadcast'
  | 'tcp_udp_proxy_possible'
  | 'community_mod'
  | 'official_only'
  | 'unsupported'
  | 'unknown';

export type ConversionMethod =
  | 'virtual_lan'
  | 'dedicated_server_launcher'
  | 'broadcast_bridge'
  | 'port_proxy'
  | 'mod_installer'
  | 'steam_relay_plugin'
  | 'manual_guide'
  | 'not_supported';

export type GameNetworkType =
  | 'lan_ip_direct'
  | 'dedicated_server'
  | 'tcp_port_proxy_needed'
  | 'udp_broadcast_needed'
  | 'steam_lobby_direct_possible'
  | 'steam_relay_plugin'
  | 'mod_required'
  | 'official_only'
  | 'not_supported'
  | 'unknown_need_review';

export interface GameConnectionPlan {
  summary: string;
  host_role: string;
  join_role: string;
  default_join_host?: string | null;
  default_join_port?: number | null;
  requires_virtual_lan: boolean;
  requires_tcp_port_proxy: boolean;
  requires_udp_broadcast_bridge: boolean;
  requires_dedicated_server: boolean;
  invite_template: string[];
  troubleshooting: string[];
}

export interface MultiplayerConversionProfile {
  capability: MultiplayerCapability;
  methods: ConversionMethod[];
  can_convert_to_lan: boolean;
  risk_level: 'low' | 'medium' | 'high';
  notes: string[];
  required_components: string[];
}

export interface LaunchConfigField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'password' | 'select' | 'checkbox';
  default_value?: string | null;
  required?: boolean | null;
  help?: string | null;
  options?: string[] | null;
}

export interface LaunchProfile {
  id: string;
  name: string;
  type: 'client' | 'server' | 'docs';
  exe?: string | null;
  args?: string[] | null;
  arg_templates?: string[] | null;
  stdin_templates?: string[] | null;
  config_fields?: LaunchConfigField[] | null;
}

export interface GameSummary {
  game_id: string;
  display_name: string;
  steam_appid?: string | null;
  detected_path?: string | null;
  capabilities: GameCapability[];
  multiplayer_conversion?: MultiplayerConversionProfile | null;
  network_type?: GameNetworkType;
  connection_plan?: GameConnectionPlan;
  adapter_source?: 'builtin' | 'registry' | 'custom' | 'steam_scan' | string;
}

export interface GameAnalysis extends GameSummary {
  confidence: 'high' | 'medium' | 'low';
  notes: string[];
  launch_profiles: LaunchProfile[];
  default_ports: number[];
}

export interface GameAdapter {
  game_id: string;
  display_name: string;
  steam_appid?: string | null;
  capabilities: GameCapability[];
  multiplayer_conversion?: MultiplayerConversionProfile | null;
  network_type?: GameNetworkType;
  connection_plan?: GameConnectionPlan;
  adapter_source?: 'builtin' | 'registry' | 'custom' | 'steam_scan' | string;
  executables: string[];
  default_ports: number[];
  launch_profiles: LaunchProfile[];
}
