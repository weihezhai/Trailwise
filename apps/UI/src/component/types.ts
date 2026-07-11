export type Panel = "overview" | "trace" | "runbook" | "automation";
export type RecordingPhase = "ready" | "recording" | "completed";
export type WorkflowStage = "prepare" | "record" | "review" | "generate";
export type LoadingAction = "test" | "runbook" | null;
export type ThemeMode = "light" | "dark";

export interface ProjectSession {
  session_id: string;
  status: string;
  target_url?: string;
  generated_artifact_path?: string;
  generated_runbook_path?: string;
  generated_skill_path?: string;
}

export interface TraceEventItem {
  step: number;
  action: string;
  state: string;
  stateClass: string;
  time: string;
  selector: string;
  result: string;
}

export interface StageCopyEntry {
  eyebrow: string;
  title: string;
  body: string;
  status: string;
}

export interface Toast {
  id: number;
  message: string;
  tone?: "error" | "default";
}
