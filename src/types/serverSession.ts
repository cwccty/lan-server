import type { LaunchConfig } from './recommendation';

export interface ServerSessionStatus {
  running: boolean;
  pid?: number | null;
  game_id?: string | null;
  profile_id?: string | null;
  ready: boolean;
  logs: string[];
  message: string;
  exit_code?: number | null;
  exited_at?: string | null;
  ever_ready: boolean;
  started_at?: string | null;
  uptime_seconds?: number | null;
}

export type ServerLaunchConfig = LaunchConfig;

export interface GenericServerLaunchConfig {
  game_name?: string | null;
  executable_path: string;
  working_dir?: string | null;
  port: number;
  args?: string[] | null;
  raw_args?: string | null;
  jar_memory_mb?: number | null;
}

export interface GenericServerPreflightCheck {
  id: string;
  level: 'ok' | 'warn' | 'block' | string;
  label: string;
  detail: string;
}

export interface GenericServerPreflightReport {
  ok: boolean;
  can_start: boolean;
  executable_path: string;
  working_dir?: string | null;
  executable_kind: string;
  port: number;
  summary: string;
  checks: GenericServerPreflightCheck[];
}
