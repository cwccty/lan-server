export interface AppSettings {
  edge_path?: string | null;
  supernode_default?: string | null;
  adapter_registry_url?: string | null;
  product_mode: boolean;
  appearance?: AppearanceSettings | null;
  log_dir?: string | null;
  tools_dir?: string | null;
  updated_at: string;
}

export type AppearanceTheme = 'system' | 'light' | 'dark' | 'warm';
export type AppearanceBackgroundMode = 'default' | 'gradient' | 'custom';

export interface AppearanceSettings {
  theme: AppearanceTheme;
  accent: string;
  background_mode: AppearanceBackgroundMode;
  background_value?: string | null;
  background_strength: number;
  background_blur: number;
}

export interface UserAccountState {
  has_account: boolean;
  logged_in: boolean;
  nickname?: string | null;
  remember_me: boolean;
  avatar_initial?: string | null;
  updated_at?: string | null;
  message: string;
}

export interface EdgePathCheck {
  ok: boolean;
  path?: string | null;
  exists: boolean;
  is_file: boolean;
  executable_name_ok: boolean;
  can_execute: boolean;
  version_hint?: string | null;
  message: string;
  stderr?: string | null;
}
