import type { LaunchConfig } from './recommendation';

export interface ServerSessionStatus {
  running: boolean;
  pid?: number;
  game_id?: string;
  profile_id?: string;
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
