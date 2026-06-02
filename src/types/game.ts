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
  default_value?: string;
  required?: boolean;
  help?: string;
  options?: string[];
}

export interface LaunchProfile {
  id: string;
  name: string;
  type: 'client' | 'server' | 'docs';
  exe?: string;
  args?: string[];
  arg_templates?: string[];
  stdin_templates?: string[];
  config_fields?: LaunchConfigField[];
}

export interface GameSummary {
  game_id: string;
  display_name: string;
  steam_appid?: string;
  detected_path?: string;
  capabilities: GameCapability[];
  multiplayer_conversion?: MultiplayerConversionProfile;
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
  steam_appid?: string;
  capabilities: GameCapability[];
  multiplayer_conversion?: MultiplayerConversionProfile;
  adapter_source?: 'builtin' | 'registry' | 'custom' | 'steam_scan' | string;
  executables: string[];
  default_ports: number[];
  launch_profiles: LaunchProfile[];
}
