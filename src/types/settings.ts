export interface AppSettings {
  edge_path?: string | null;
  supernode_default?: string | null;
  adapter_registry_url?: string | null;
  product_mode: boolean;
  log_dir?: string | null;
  tools_dir?: string | null;
  updated_at: string;
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
