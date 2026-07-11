import { type RefObject } from "react";
import type { TraceEventItem } from "./types";
import { MovingBorderButton } from "./ui/MovingBorderButton";
import { CircleDot } from "lucide-react";

const icon18 = { size: 18, strokeWidth: 1.75 };

interface TraceReviewPanelProps {
  workflowStage: string;
  traceEvents: TraceEventItem[];
  selectedStep: number;
  panelRef?: RefObject<HTMLElement | null>;
  setSelectedStep: (step: number) => void;
  onConfirmMemory: () => void;
  visibleEventClass: (event: TraceEventItem) => string;
  visibleEventState: (event: TraceEventItem) => string;
}

export default function TraceReviewPanel(props: TraceReviewPanelProps) {
  const { workflowStage, traceEvents, selectedStep, panelRef, setSelectedStep, onConfirmMemory, visibleEventClass, visibleEventState } = props;

  return (
    <article className={`timeline-card ${workflowStage === "record" || workflowStage === "review" ? "is-emphasized" : "is-secondary"}`} ref={panelRef}>
      <h2>Review structured memory</h2>
      <p>Use this detail view only when you need to inspect the captured actions behind the memory summary.</p>
      <div className="timeline-layout">
        <div className="table">
          <div className="table-head">
            <span>Step</span>
            <span>Action</span>
            <span>State</span>
            <span>Time</span>
          </div>
          {traceEvents.map((event) => (
            <button className={selectedStep === event.step ? "table-row selected" : "table-row"} key={event.step} onClick={() => setSelectedStep(event.step)}>
              <span>{event.step}</span>
              <strong>{event.action}</strong>
              <em className={visibleEventClass(event)}>{visibleEventState(event)}</em>
              <span>{event.time}</span>
            </button>
          ))}
          <MovingBorderButton className="btn dark primary-action" onClick={onConfirmMemory}>
            Confirm memory <CircleDot {...icon18} aria-hidden="true" />
          </MovingBorderButton>
        </div>
        <div className="flow-map">
          <span>Stage map</span>
          <em className={selectedStep === 1 ? "active" : ""}>Nav</em>
          <em className={selectedStep === 3 ? "active" : ""}>Input</em>
          <em className={selectedStep === 4 ? "active" : ""}>Submit</em>
          <em className={selectedStep >= 5 ? "active" : ""}>Verify</em>
        </div>
      </div>
    </article>
  );
}
