export interface RecordingSession {
  session_id: string;
  status: string;
  target_url?: string;
  created_at?: string;
  started_at?: string;
  stopped_at?: string;
  generated_artifact_path?: string;
  generated_runbook_path?: string;
  generated_skill_path?: string;
  summary?: {
    session_id: string;
    duration_ms: number;
    url_start?: string;
    url_end?: string;
    events_count: number;
    screenshots_count: number;
    redactions_count: number;
    trace_path?: string;
    video_path?: string;
    skill_path?: string;
  };
}

export interface SessionLogEvent {
  seq: number;
  type: "session_started" | "navigation" | "click" | "input" | "submit" | "session_stopped" | "session_cancelled";
  ts: number;
  url?: string;
  title?: string;
  selector?: string;
  role?: string;
  label?: string;
  text?: string;
  screenshot?: string;
  value_policy?: "none" | "redacted" | "synthetic" | "typed_text_placeholder";
  value?: string;
  element?: {
    tag?: string | null;
    selector?: string | null;
    text?: string | null;
    ariaLabel?: string | null;
    role?: string | null;
    type?: string | null;
    name?: string | null;
    id?: string | null;
    placeholder?: string | null;
    label?: string | null;
  } | null;
}

export interface SessionLog {
  session: RecordingSession;
  session_id: string;
  status: string;
  target_url: string;
  started_at?: string;
  stopped_at?: string;
  duration_ms?: number | null;
  events: SessionLogEvent[];
}

export declare function startRecording(url: string, sessionId?: string): Promise<any>;
export declare function stopRecording(sessionId?: string): Promise<any>;
export declare function statusRecording(sessionId?: string): Promise<any>;
export declare function listSessions(): Promise<RecordingSession[]>;
export declare function getSessionLog(id: string): Promise<SessionLog>;
export declare function generateTest(id?: string): Promise<any>;
export declare function generateRunbook(id?: string): Promise<any>;
export declare function generateSkill(id?: string): Promise<any>;
export declare function deleteSession(id: string): Promise<any>;
