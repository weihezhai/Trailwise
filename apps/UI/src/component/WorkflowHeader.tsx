import { GitBranch } from "lucide-react";

interface WorkflowHeaderProps {
  title: string;
  statusLabel: string;
  isRecording: boolean;
  isCompleted: boolean;
  memoryConfirmed: boolean;
  currentSessionStatus?: string;
}

const icon20 = { size: 20, strokeWidth: 1.75 };

export default function WorkflowHeader(props: WorkflowHeaderProps) {
  const { title, statusLabel, isRecording, isCompleted, memoryConfirmed, currentSessionStatus } = props;

  return (
    <>
      <div className="header-surface" />
      <div className="header-grid" />
      <div className="breadcrumb">Trailwise / Projects / Expense Approval / Trace detail</div>
      <div className="title-icon">
        <GitBranch {...icon20} aria-hidden="true" />
      </div>

      <div className="title-row">
        <h1>{title}</h1>
        <span className={isRecording ? "pill red" : isCompleted ? "pill green" : "pill amber"}>{statusLabel}</span>
        <span className={isCompleted ? "pill green" : "pill amber"}>{memoryConfirmed ? "Memory saved" : isCompleted ? "Review memory" : "Not recorded yet"}</span>
      </div>
      {currentSessionStatus && (
        <div className="session-status-row">
          <span>Session status: {currentSessionStatus}</span>
        </div>
      )}
    </>
  );
}
