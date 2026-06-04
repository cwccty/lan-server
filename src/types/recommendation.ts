export type RecommendationLevel = 'recommended' | 'tryable' | 'unsupported' | 'unknown';

export interface Recommendation {
  id: string;
  title: string;
  level: RecommendationLevel;
  backend_id?: string | null;
  estimated_latency_ms?: number | null;
  required_actions: string[];
  launch_profile_id?: string | null;
}

export type LaunchConfig = Record<string, string | number | boolean>;

export interface LaunchResult {
  ok: boolean;
  message: string;
}
