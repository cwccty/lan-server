export interface ReleaseCheck {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
  required_for_mvp: boolean;
}

export interface DiagnosticReport {
  generated_at: string;
  app_version: string;
  os: string;
  summary: string;
  release_ready: boolean;
  required_passed: number;
  required_total: number;
  next_actions: string[];
  release_checks: ReleaseCheck[];
  details: string[];
}
