import { forwardRef } from "react";
import { Activity, BookOpen, CircleDot, Copy, FileCode, Play, Route, Square } from "lucide-react";

const icon18 = { size: 18, strokeWidth: 1.75 };

type Panel = "overview" | "trace" | "runbook";
type WorkflowStage = "prepare" | "record" | "review" | "generate";
type LoadingAction = "test" | "runbook" | null;

type StageCopyRecord = Record<
  WorkflowStage,
  { eyebrow: string; title: string; body: string; status: string }
>;

interface WorkflowSummaryCardProps {
  workflowStage: WorkflowStage;
  workflowSteps: Array<{ id: WorkflowStage; label: string; detail: string }>;
  stageCopy: StageCopyRecord;
  statusLabel: string;
  durationSeconds: number;
  actionsCaptured: number;
  isRecording: boolean;
  isCompleted: boolean;
  loadingAction: LoadingAction;
  formatDuration: (value: number) => string;
  onBeginRecording: () => void;
  onCheckStatus: () => void;
  onStopRecording: () => void;
  onGenerateArtifact: (kind: Exclude<LoadingAction, null>) => void;
  onJumpTo: (panel: Panel) => void;
  onCopyRunbook: () => void;
}

const WorkflowSummaryCard = forwardRef<HTMLElement, WorkflowSummaryCardProps>(function WorkflowSummaryCard(
  {
    workflowStage,
    workflowSteps,
    stageCopy,
    statusLabel,
    durationSeconds,
    actionsCaptured,
    isRecording,
    isCompleted,
    loadingAction,
    formatDuration,
    onBeginRecording,
    onCheckStatus,
    onStopRecording,
    onGenerateArtifact,
    onJumpTo,
    onCopyRunbook,
  },
  ref,
) {
  const workflowStageIndex = workflowSteps.findIndex((step) => step.id === workflowStage);

  return (
    /*
  <article className={`summary-card stage-${workflowStage} ${isRecording ? "is-live" : ""}`} ref={summaryRef}>
  <div className="phase-strip" aria-label="Workflow progress">
    {workflowSteps.map((step, index) => {
      const stepState =
        index < workflowStageIndex ? "complete" : index === workflowStageIndex ? "active" : "future";
      return (
        <button
          className={`phase-step ${stepState}`}
          disabled={stepState === "future"}
          key={step.id}
          onClick={() => {
            if (step.id === "prepare") onJumpTo("overview");
            if (step.id === "record") onJumpTo("overview");
            if (step.id === "review") onJumpTo("trace");
            if (step.id === "generate") onJumpTo("runbook");
          }}
          type="button"
        >
          <span>{index + 1}</span>
          <strong>{step.label}</strong>
          <em>{step.detail}</em>
        </button>
      );
    })}
  </div>
  <div className="stage-header">
    <div>
      <span className="stage-eyebrow">{stageCopy[workflowStage].eyebrow}</span>
      <h2>{stageCopy[workflowStage].title}</h2>
      <p>{stageCopy[workflowStage].body}</p>
    </div>
    <span className={`stage-status ${isRecording ? "red recording-pulse" : isCompleted ? "green" : ""}`}>
      <CircleDot {...icon18} aria-hidden="true" />
      {stageCopy[workflowStage].status}
    </span>
  </div>
  <div className="guided-stage-grid">
    <div className="guided-stage-primary">
      {workflowStage === "prepare" && (
        <div className="target-capture-panel">
          <label className="guided-url-field">
            <span>Target URL</span>
            <input
              aria-label="Target URL"
              value={targetUrl}
              onChange={(event) => setTargetUrl(event.target.value)}
              placeholder="http://localhost:5173"
            />
          </label>
          <div className="helper-inline">
            <CircleDot {...icon18} aria-hidden="true" />
            <div>
              <strong>Local helper ready</strong>
              <span>Chrome recording will start after local confirmation.</span>
            </div>
          </div>
        </div>
      )}

      {workflowStage === "record" && (
        <div className="target-capture-panel live-capture-panel">
          <div className="live-indicator">
            <CircleDot className="recording-pulse" {...icon18} aria-hidden="true" />
            <div>
              <strong>Recording browser workflow</strong>
              <span>Demonstrate the full path once, then stop to structure memory.</span>
            </div>
          </div>
        </div>
      )}

      <div className="metrics">
        <div>
          <span>Status</span>
          <strong className={isRecording ? "red-text" : isCompleted ? "green-text" : ""}>
            {statusLabel}
          </strong>
        </div>
        <div>
          <span>Duration</span>
          <strong>{formatDuration(durationSeconds)}</strong>
        </div>
        <div>
          <span>Actions captured</span>
          <strong>{actionsCaptured}</strong>
        </div>
        <div>
          <span>Session</span>
          <strong>Active</strong>
        </div>
      </div>

      {isCompleted ? (
        <div className="learned-memory-panel">
          <div className="learned-head">
            <div>
              <span>WHAT TRAILWISE LEARNED</span>
              <h3>Expense approval can be reproduced from a clean browser state.</h3>
            </div>
            <span className={memoryConfirmed ? "pill green" : "pill amber"}>
              {memoryConfirmed ? "Confirmed" : "Needs review"}
            </span>
          </div>
          <ol>
            <li>
              <strong>Initial state</strong>
              <span>Open the target URL with the local helper connected.</span>
            </li>
            <li>
              <strong>Operating path</strong>
              <span>Create an approval request, fill required fields, and submit.</span>
            </li>
            <li>
              <strong>Expected result</strong>
              <span>Success confirmation appears and the result state is captured.</span>
            </li>
          </ol>
        </div>
      ) : (
        <div className="memory-entry-card">
          <div>
            <span>Workflow memory</span>
              <strong>Waiting for recording</strong>
          </div>
          <div>
            <span>Initial state</span>
            <strong>Target URL and local helper ready</strong>
          </div>
          <div>
            <span>Stage result</span>
            <strong>Record one successful workflow path</strong>
          </div>
        </div>
      )}

      <div className="stage-action-bar">
        {workflowStage === "prepare" && (
          <>
            <MovingBorderButton className="btn dark primary-action" onClick={beginRecording}>
              Start recording <Play {...icon18} aria-hidden="true" />
            </MovingBorderButton>
            <button className="btn light" onClick={checkStatus}>
              Check helper <Activity {...icon18} aria-hidden="true" />
            </button>
          </>
        )}
        {workflowStage === "record" && (
          <>
            <MovingBorderButton className="btn dark primary-action" onClick={stopRecording}>
              Stop and structure memory <Square {...icon18} aria-hidden="true" />
            </MovingBorderButton>
            <button className="btn light" onClick={checkStatus}>
              Live status <Activity {...icon18} aria-hidden="true" />
            </button>
          </>
        )}
        {workflowStage === "review" && (
          <>
            <MovingBorderButton className="btn dark primary-action" onClick={confirmMemory}>
              Confirm memory <CircleDot {...icon18} aria-hidden="true" />
            </MovingBorderButton>
            <button className="btn light" onClick={() => openPanel("trace")}>
              Inspect details <Route {...icon18} aria-hidden="true" />
            </button>
          </>
        )}
        {workflowStage === "generate" && (
          <>
            <MovingBorderButton className="btn dark primary-action" onClick={queueAutomation}>
              Run robot <Bot {...icon18} aria-hidden="true" />
            </MovingBorderButton>
            <button
              className={loadingAction === "runbook" ? "btn light loading" : "btn light"}
              disabled={loadingAction !== null}
              onClick={() => (generatedArtifacts.runbook ? openPanel("runbook") : generateArtifact("runbook"))}
            >
              {generatedArtifacts.runbook ? "Open output" : "Generate Runbook"} <BookOpen {...icon18} aria-hidden="true" />
            </button>
            <button
              className={loadingAction === "test" ? "btn light loading" : "btn light"}
              disabled={loadingAction !== null}
              onClick={() => generateArtifact("test")}
            >
              Generate Test <FileCode {...icon18} aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </div>

    <aside className="workflow-preview-panel">
      <span>{workflowStage === "generate" ? "READY TO REUSE" : "WHAT TRAILWISE CAPTURES"}</span>
      <h3>
        {workflowStage === "generate"
          ? "This memory can now guide people or a robot run."
          : workflowStage === "review"
            ? "Confirm the summary instead of reading every event."
            : "Record once, then reuse the workflow later."}
      </h3>
      <ul>
        <li>{workflowStage === "generate" ? "Run the automation robot" : "Browser actions and timing"}</li>
        <li>{workflowStage === "generate" ? "Generate Runbook or Test Case" : "Key screen states and stage results"}</li>
        <li>{workflowStage === "generate" ? "Pause for human handoff when needed" : "Sensitive input redaction"}</li>
      </ul>
    </aside>
  </div>
  <div className="trust-strip">
    <span>{isCompleted ? "Keyframes extracted" : "Target URL ready"}</span>
    <span>{isCompleted ? "Stage results" : "Local helper ready"}</span>
    <span>{memoryConfirmed ? "Memory saved" : isCompleted ? "Review required" : "Ready to record"}</span>
  </div>
</article>
    */
    <article
      className={`summary-card stage-${workflowStage} ${isRecording ? "is-live" : ""}`}
      ref={ref}
    >
      <div className="phase-strip" aria-label="Workflow progress">
        {workflowSteps.map((step, index) => {
          const stepState =
            index < workflowStageIndex ? "complete" : index === workflowStageIndex ? "active" : "future";

          return (
            <button
              className={`phase-step ${stepState}`}
              disabled={stepState === "future"}
              key={step.id}
              onClick={() => {
                if (step.id === "prepare") onJumpTo("overview");
                if (step.id === "record") onJumpTo("overview");
                if (step.id === "review") onJumpTo("trace");
                if (step.id === "generate") onJumpTo("runbook");
              }}
              type="button"
            >
              <span>{index + 1}</span>
              <strong>{step.label}</strong>
              <em>{step.detail}</em>
            </button>
          );
        })}
      </div>

      <div className="stage-header">
        <div>
          <span className="stage-eyebrow">{stageCopy[workflowStage].eyebrow}</span>
          <h2>{stageCopy[workflowStage].title}</h2>
          <p>{stageCopy[workflowStage].body}</p>
        </div>
        <span className={`stage-status ${isRecording ? "red recording-pulse" : isCompleted ? "green" : ""}`}>
          <CircleDot {...icon18} aria-hidden="true" />
          {stageCopy[workflowStage].status}
        </span>
      </div>

      <div className="metrics">
        <div>
          <span>Status</span>
          <strong className={isRecording ? "red-text" : isCompleted ? "green-text" : ""}>{statusLabel}</strong>
        </div>
        <div>
          <span>Duration</span>
          <strong>{formatDuration(durationSeconds)}</strong>
        </div>
        <div>
          <span>Actions captured</span>
          <strong>{actionsCaptured}</strong>
        </div>
        <div>
          <span>Session</span>
          <strong>Active</strong>
        </div>
      </div>

      <div className="stage-action-bar">
        {workflowStage === "prepare" && (
          <>
            <button className="btn dark primary-action" onClick={onBeginRecording}>
              Start recording <Play {...icon18} aria-hidden="true" />
            </button>
            <button className="btn light" onClick={onCheckStatus}>
              Check status <Activity {...icon18} aria-hidden="true" />
            </button>
          </>
        )}
        {workflowStage === "record" && (
          <>
            <button className="btn dark primary-action" onClick={onStopRecording}>
              Stop recording <Square {...icon18} aria-hidden="true" />
            </button>
            <button className="btn light" onClick={onCheckStatus}>
              Live status <Activity {...icon18} aria-hidden="true" />
            </button>
          </>
        )}
        {workflowStage === "review" && (
          <>
            <button className="btn dark primary-action" onClick={() => onJumpTo("trace")}>
              Inspect trace <Route {...icon18} aria-hidden="true" />
            </button>
            <button
              className={loadingAction === "test" ? "btn light loading" : "btn light"}
              disabled={loadingAction !== null}
              onClick={() => onGenerateArtifact("test")}
            >
              Generate Test <FileCode {...icon18} aria-hidden="true" />
            </button>
            <button
              className={loadingAction === "runbook" ? "btn light loading" : "btn light"}
              disabled={loadingAction !== null}
              onClick={() => onGenerateArtifact("runbook")}
            >
              Generate Runbook <BookOpen {...icon18} aria-hidden="true" />
            </button>
            <button className="btn light" onClick={onCheckStatus}>
              Status <Activity {...icon18} aria-hidden="true" />
            </button>
          </>
        )}
        {workflowStage === "generate" && (
          <>
            <button className="btn dark primary-action" onClick={() => onJumpTo("runbook")}>
              Open output <BookOpen {...icon18} aria-hidden="true" />
            </button>
            <button className="btn light" onClick={onCopyRunbook}>
              Copy runbook <Copy {...icon18} aria-hidden="true" />
            </button>
            <button className="btn light" onClick={onCheckStatus}>
              Status <Activity {...icon18} aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      <div className="trust-strip">
        <span>Signed trace</span>
        <span>Secrets redacted</span>
        <span>Localhost target</span>
      </div>
    </article>
  );
});

export default WorkflowSummaryCard;
