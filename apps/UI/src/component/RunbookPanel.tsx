import { type RefObject } from "react";
import { Bot, Copy } from "lucide-react";
import { MovingBorderButton } from "./ui/MovingBorderButton";

interface RunbookPanelProps {
  workflowStage: string;
  memoryConfirmed: boolean;
  runbookText: string;
  copied: boolean;
  panelRef?: RefObject<HTMLElement | null>;
  onCopyRunbook: () => void;
  onConfirmRunBook: () => void;
}

export default function RunbookPanel(props: RunbookPanelProps) {
  const { workflowStage, memoryConfirmed, runbookText, copied, panelRef, onCopyRunbook, onConfirmRunBook } = props;

  return (
    <article className={`runbook-card ${workflowStage === "generate" ? "is-emphasized" : "is-secondary"}`} ref={panelRef}>
      <div className="card-head">
        <div>
          <h2>Outputs from workflow memory</h2>
          <p>Generated from workflow memory, with initial state and expected stage results preserved.</p>
        </div>
        <button className="btn light" disabled={!memoryConfirmed} onClick={onCopyRunbook}>
          Copy runbook <Copy size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
      <div className="code-panel">
        <div className="code-tabs">
          <span>workflow_memory.md</span>
          <span>runbook.md</span>
          <button aria-label="Copy" className={copied ? "copied" : ""} onClick={onCopyRunbook}>
            <Copy size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
        <pre>{runbookText}</pre>
      </div>
      <MovingBorderButton className="btn dark primary-action" onClick={onConfirmRunBook}>
        Confirm Run Book <Bot size={18} strokeWidth={1.75} aria-hidden="true" />
      </MovingBorderButton>
    </article>
  );
}
