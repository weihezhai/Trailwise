import { forwardRef } from "react";

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

interface TraceTimelineCardProps {
  workflowStage: WorkflowStage;
  traceEvents: TraceEvent[];
  selectedStep: number;
  isRecording: boolean;
  isCompleted: boolean;
  onSelectStep: (step: number) => void;
}

const TraceTimelineCard = forwardRef<HTMLElement, TraceTimelineCardProps>(function TraceTimelineCard(
  { workflowStage, traceEvents, selectedStep, isRecording, isCompleted, onSelectStep },
  ref,
) {
  const visibleEventState = (event: TraceEvent) => {
    if (selectedStep === event.step) return "Selected";
    if (isRecording && event.step > Math.max(1, Math.min(99, 6))) return "Pending";
    if (isCompleted && event.step <= 6) return "Done";
    return event.state;
  };

  const visibleEventClass = (event: TraceEvent) => {
    if (selectedStep === event.step) return "";
    const state = visibleEventState(event);
    if (state === "Done") return "done";
    if (state === "Pending") return "pending";
    return event.stateClass;
  };

  return (
  
    <article
      className={`timeline-card ${workflowStage === "record" || workflowStage === "review" ? "is-emphasized" : "is-secondary"}`}
      ref={ref}
    >
      <h2>Trace timeline</h2>
      <p>List-detail flow: selecting an event updates the inspector.</p>
      <div className="timeline-layout">
        <div className="table">
          <div className="table-head">
            <span>Step</span>
            <span>Action</span>
            <span>State</span>
            <span>Time</span>
          </div>
          {traceEvents.map((event) => (
            <button
              className={selectedStep === event.step ? "table-row selected" : "table-row"}
              key={event.step}
              onClick={() => onSelectStep(event.step)}
            >
              <span>{event.step}</span>
              <strong>{event.action}</strong>
              <em className={visibleEventClass(event)}>{visibleEventState(event)}</em>
              <span>{event.time}</span>
            </button>
          ))}
        </div>
        <div className="flow-map">
          <span>Flow map</span>
          <em className={selectedStep === 1 ? "active" : ""}>Nav</em>
          <em className={selectedStep === 3 ? "active" : ""}>Input</em>
          <em className={selectedStep === 4 ? "active" : ""}>Submit</em>
          <em className={selectedStep >= 5 ? "active" : ""}>Verify</em>
        </div>
      </div>
    </article>
  );
});

export default TraceTimelineCard;
