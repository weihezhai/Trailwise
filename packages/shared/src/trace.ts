export type TraceEventType =
  | "session_started"
  | "navigation"
  | "click"
  | "input"
  | "submit"
  | "session_stopped"
  | "session_cancelled";

export type ValuePolicy = "none" | "redacted" | "synthetic" | "typed_text_placeholder";

export interface ElementMetadata {
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
  boundingClientRect?: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  } | null;
}

export interface TraceEvent {
  seq: number;
  type: TraceEventType;
  ts: number;
  url?: string;
  title?: string;
  selector?: string;
  role?: string;
  label?: string;
  text?: string;
  element?: ElementMetadata;
  screenshot?: string;
  value_policy?: ValuePolicy;
  value?: string;
}

export interface RedactedValueHint {
  field: string;
  suggested_test_value: string;
}

export interface WorkflowTrace {
  schema_version: "0.1";
  session_id: string;
  platform: "macos";
  browser: "chrome";
  started_at: string;
  target_url: string;
  stopped_at?: string;
  duration_ms?: number;
  redacted_values?: RedactedValueHint[];
  events: TraceEvent[];
}

export interface SessionSummary {
  session_id: string;
  duration_ms: number;
  url_start?: string;
  url_end?: string;
  events_count: number;
  screenshots_count: number;
  redactions_count: number;
  trace_path?: string;
}

export const SENSITIVE_FIELD_PATTERN =
  /password|passwd|token|secret|api[_-]?key|credit|card|otp|ssn|security\s*code|cvv/i;

export function isSensitiveFieldText(value: unknown): boolean {
  return typeof value === "string" && SENSITIVE_FIELD_PATTERN.test(value);
}

export function eventLooksSensitive(event: TraceEvent): boolean {
  const element = event.element ?? {};
  return [
    event.selector,
    event.label,
    event.text,
    element.selector,
    element.ariaLabel,
    element.name,
    element.id,
    element.placeholder,
    element.label,
    element.type
  ].some(isSensitiveFieldText);
}
