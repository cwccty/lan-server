export type RecommendationLevel = 'recommended' | 'tryable' | 'unsupported' | 'unknown';

export interface Recommendation {
  id: string;
  title: string;
  level: RecommendationLevel;
  backend_id?: string;
  estimated_latency_ms?: number;
  required_actions: string[];
  launch_profile_id?: string;
}

export type LaunchConfig = Record<string, string | number | boolean>;

export interface LaunchResult {
  ok: boolean;
  message: string;
}
