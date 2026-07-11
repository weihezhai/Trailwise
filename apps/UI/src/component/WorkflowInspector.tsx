import type { TraceEventItem } from "./types";

interface WorkflowInspectorProps {
  selectedEvent: TraceEventItem | null;
  currentSessionId?: string;
  targetUrl: string;
  traceLoading: boolean;
}

export default function WorkflowInspector(props: WorkflowInspectorProps) {
  const { selectedEvent, currentSessionId, targetUrl, traceLoading } = props;

  return (
    <aside className="inspector">
      <div className="eyebrow">MEMORY DETAIL</div>

      {selectedEvent ? (
        <div className="inspector-content" key={`${currentSessionId}-${selectedEvent.step}`}>
          <div className="inspector-title">
            <h2>{selectedEvent.action}</h2>
            <span className="pill">Selected</span>
          </div>

          <p>
            Event {selectedEvent.step} from session {currentSessionId}.
          </p>

          <div className="inspector-section">
            <dl>
              <dt>Time</dt>
              <dd>{selectedEvent.time}</dd>

              <dt>Selector</dt>
              <dd>{selectedEvent.selector}</dd>

              <dt>Result</dt>
              <dd>{selectedEvent.result}</dd>

              <dt>Target</dt>
              <dd>{targetUrl}</dd>
            </dl>
          </div>
        </div>
      ) : (
        <div className="inspector-content">
          <div className="inspector-title">
            <h2>{traceLoading ? "Loading workflow memory..." : "No workflow memory"}</h2>
          </div>

          <p>{traceLoading ? "Loading the selected project's recorded events." : "This project has no confirmed recording details yet."}</p>
        </div>
      )}
    </aside>
  );
}
