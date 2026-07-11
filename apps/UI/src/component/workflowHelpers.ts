import type { TraceEventItem } from "./types";

export interface TraceEventLike {
  type: string;
  ts?: number | null;
  url?: string;
  text?: string;
  selector?: string;
  label?: string;
  value?: string;
}

export function buildAction(event: TraceEventLike) {
  switch (event.type) {
    case "session_started":
      return "Start recording";
    case "navigation":
      return `Navigate to ${event.url}`;
    case "click":
      return `Click ${event.text || event.selector}`;
    case "input":
      return `Input ${event.label || event.selector}`;
    case "submit":
      return "Submit form";
    case "session_stopped":
      return "Stop recording";
    default:
      return event.type;
  }
}

export function buildResult(event: TraceEventLike) {
  switch (event.type) {
    case "navigation":
      return "Page loaded";
    case "click":
      return event.text || "Clicked element";
    case "input":
      return event.value || "Input entered";
    case "submit":
      return "Form submitted";
    case "session_started":
      return "Recording started";
    case "session_stopped":
      return "Recording finished";
    default:
      return "-";
  }
}

export function formatTime(ms: number | null | undefined) {
  if (ms == null) return "--:--";

  const seconds = Math.floor(ms / 1000);
  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");

  return `${m}:${s}`;
}

export function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function transformTraceEvents(events: TraceEventLike[]): TraceEventItem[] {
  return events
    .filter(
      (event) =>
        event.type !== "session_started" &&
        event.type !== "session_stopped" &&
        event.type !== "session_cancelled",
    )
    .map((event, index) => ({
      step: index + 1,
      action: buildAction(event),
      state: "Done",
      stateClass: "done",
      time: formatTime(event.ts),
      selector: event.selector ?? event.url ?? "-",
      result: buildResult(event),
    }));
}
