import type { LaunchConfig } from './recommendation';

export interface ServerSessionStatus {
  running: boolean;
  pid?: number;
  game_id?: string;
  profile_id?: string;
  logs: string[];
  message: string;
}

export type ServerLaunchConfig = LaunchConfig;
