import { forwardRef } from "react";
import { BookOpen, Copy } from "lucide-react";

const icon18 = { size: 18, strokeWidth: 1.75 };

interface RunbookCardProps {
  workflowStage: "prepare" | "record" | "review" | "generate";
  runbookText: string;
  copied: boolean;
  isCompleted: boolean;
  onCopyRunbook: () => void;
  onJumpTo: (panel: "overview" | "trace" | "runbook") => void;
}

const RunbookCard = forwardRef<HTMLElement, RunbookCardProps>(function RunbookCard(
  { workflowStage, runbookText, copied, isCompleted, onCopyRunbook, onJumpTo },
  ref,
) {
  return (
    <article
      className={`runbook-card ${workflowStage === "generate" ? "is-emphasized" : "is-secondary"}`}
      ref={ref}
    >
      <div className="card-head">
        <div>
          <h2>Generated Runbook</h2>
          <p>Structured output remains attached to this recording.</p>
        </div>
        <button className="btn light" disabled={!isCompleted} onClick={() => onJumpTo("runbook")}>
          Open draft <BookOpen {...icon18} aria-hidden="true" />
        </button>
      </div>
      <div className="code-panel">
        <div className="code-tabs">
          <span>expense_runbook.md</span>
          <span>trace.json</span>
          <button aria-label="Copy" className={copied ? "copied" : ""} onClick={onCopyRunbook}>
            <Copy {...icon18} aria-hidden="true" />
          </button>
        </div>
        <pre>{runbookText}</pre>
      </div>
    </article>
  );
});

export default RunbookCard;
