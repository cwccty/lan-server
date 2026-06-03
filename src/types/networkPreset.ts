export interface NetworkSetupPreset {
  gameId?: string;
  displayName?: string;
  defaultPort?: number;
  capability?: string;
  recommendedMethods?: string[];
  source?: string;
  note?: string;
  roomName?: string;
  secret?: string;
  supernode?: string;
  localIp?: string;
  peerIp?: string;
  appliedAt: number;
}
