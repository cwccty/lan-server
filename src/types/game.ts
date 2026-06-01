export type GameCapability =
  | 'lan'
  | 'ip_join'
  | 'dedicated_server'
  | 'steam_lobby'
  | 'steam_p2p'
  | 'official_server'
  | 'unknown';

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
  executables: string[];
  default_ports: number[];
  launch_profiles: LaunchProfile[];
}
