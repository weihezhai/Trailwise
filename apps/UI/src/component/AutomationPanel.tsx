import { type RefObject } from "react";
import { Activity, Bot, GitBranch } from "lucide-react";

interface AutomationPanelProps {
  isCompleted: boolean;
  actionsCaptured: number;
  panelRef?: RefObject<HTMLElement | null>;
  onQueueAutomation: () => void;
  onCheckStatus: () => void;
}

export default function AutomationPanel(props: AutomationPanelProps) {
  const { isCompleted, actionsCaptured, panelRef, onQueueAutomation, onCheckStatus } = props;

  return (
    <article className="automation-card is-emphasized" ref={panelRef}>
      <div className="card-head">
        <div>
          <span className="eyebrow">BACKGROUND AUTOMATION</span>
          <h2>Automation robot operator</h2>
          <p>Start a guided robot run from the confirmed workflow memory. Trailwise stays in the background and asks only when handoff is needed.</p>
        </div>
        <span className={isCompleted ? "pill green" : "pill amber"}>{isCompleted ? "Ready" : "Waiting"}</span>
      </div>

      <div className="automation-grid">
        <div>
          <GitBranch size={18} strokeWidth={1.75} aria-hidden="true" />
          <strong>Workflow memory</strong>
          <span>{isCompleted ? `${actionsCaptured} actions with stage results` : "Waiting for structured memory"}</span>
        </div>
        <div>
          <Bot size={18} strokeWidth={1.75} aria-hidden="true" />
          <strong>Robot control</strong>
          <span>{isCompleted ? "Plan, operate, verify, report" : "Paused until memory is ready"}</span>
        </div>
        <div>
          <Activity size={18} strokeWidth={1.75} aria-hidden="true" />
          <strong>Human handoff</strong>
          <span>Stops for login, CAPTCHA, permissions, or confirmation</span>
        </div>
      </div>

      <div className="automation-footer">
        <button className="btn dark primary-action" disabled={!isCompleted} onClick={onQueueAutomation}>
          Queue robot run <Bot size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <button className="btn light" onClick={onCheckStatus}>
          Check readiness <Activity size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}
