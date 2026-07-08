import { Play } from "lucide-react";

const icon18 = { size: 18, strokeWidth: 1.75 };

type WorkflowStage = "prepare" | "record" | "review" | "generate";

type TraceEvent = {
  step: number;
  action: string;
  state: string;
  stateClass: string;
  time: string;
  selector: string;
  result: string;
};

interface TraceInspectorProps {
  workflowStage: WorkflowStage;
  selectedEvent: TraceEvent;
  selectedRecording: { title: string };
  targetUrl: string;
  isRecording: boolean;
  isCompleted: boolean;
  actionsCaptured: number;
  onBeginRecording: () => void;
}

export default function TraceInspector({
  workflowStage,
  selectedEvent,
  selectedRecording,
  targetUrl,
  isRecording,
  isCompleted,
  actionsCaptured,
  onBeginRecording,
}: TraceInspectorProps) {
  return (
    <aside className={`inspector ${workflowStage === "prepare" ? "is-secondary" : ""}`}>
      <div className="eyebrow">TRACE INSPECTOR</div>
      <div className="inspector-content">
        <div className="inspector-title">
          <h2>{selectedEvent.action}</h2>
          <span className="pill">Selected</span>
        </div>
        <p>Event {selectedEvent.step} from the selected {selectedRecording.title} recording.</p>

        <div className="inspector-section">
          <h3>Event properties</h3>
          <dl>
            <dt>Selector</dt>
            <dd>{selectedEvent.selector}</dd>
            <dt>Action</dt>
            <dd>click</dd>
            <dt>Result</dt>
            <dd>{selectedEvent.result}</dd>
            <dt>Timestamp</dt>
            <dd>{selectedEvent.time}</dd>
          </dl>
        </div>

        <div className="inspector-section">
          <div className="section-head">
            <h3>Local handoff</h3>
            <span className={isRecording ? "pill red" : "pill amber"}>
              {isRecording ? "Recording" : "Awaiting"}
            </span>
          </div>
          <dl>
            <dt>Device</dt>
            <dd>Sun Junxiao MacBook Pro</dd>
            <dt>Target</dt>
            <dd>{targetUrl}</dd>
            <dt>Session</dt>
            <dd>sess_mr0re8sa_8u0xr4</dd>
          </dl>
        </div>
      </div>

      <button className="btn dark block" disabled={isRecording} onClick={onBeginRecording}>
        Confirm locally on the Mac <Play {...icon18} aria-hidden="true" />
      </button>

      <div className="inspector-section artifacts-section">
        <div className="section-head">
          <h3>Artifacts</h3>
          <span className={isCompleted ? "pill green" : "pill"}>{isCompleted ? "Ready" : "Draft"}</span>
        </div>
        <div className="artifact-row">
          <strong>
            Structured trace<span>{actionsCaptured} parsed events</span>
          </strong>
          <em>{isCompleted ? "OK" : "--"}</em>
        </div>
        <div className="artifact-row">
          <strong>
            Runbook<span>{isCompleted ? "draft available" : "waiting for completed trace"}</span>
          </strong>
          <em>{isCompleted ? "1" : "--"}</em>
        </div>
        <div className="artifact-row">
          <strong>
            Trace bundle<span>{isCompleted ? "signed and redacted" : "capture pending"}</span>
          </strong>
          <em>{isCompleted ? "OK" : "--"}</em>
        </div>
      </div>
    </aside>
  );
}
