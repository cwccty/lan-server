import type { LaunchConfig } from './recommendation';

export interface ServerSessionStatus {
  running: boolean;
  pid?: number;
  game_id?: string;
  profile_id?: string;
  ready: boolean;
  logs: string[];
  message: string;
  exit_code?: number;
  exited_at?: string;
  ever_ready: boolean;
}

export type ServerLaunchConfig = LaunchConfig;
