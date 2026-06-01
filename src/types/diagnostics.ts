export interface DiagnosticReport {
  generated_at: string;
  app_version: string;
  os: string;
  summary: string;
  details: string[];
}
