export interface NetworkSetupPreset {
  gameId?: string;
  displayName?: string;
  defaultPort?: number;
  capability?: string;
  recommendedMethods?: string[];
  source?: string;
  note?: string;
  appliedAt: number;
}
