import ProjectsBar from "./ProjectsBar";

interface SidebarSession {
  session_id: string;
  status: string;
  target_url?: string;
}

interface WorkspaceSidebarProps {
  sessions: SidebarSession[];
  currentSession: SidebarSession | null;
  loadSessions: () => Promise<unknown>;
  onOpenSession: (session: SidebarSession) => void;
}

export default function WorkspaceSidebar({
  sessions,
  currentSession,
  loadSessions,
  onOpenSession,
}: WorkspaceSidebarProps) {
  return (
    <aside className="context-sidebar">
      <div className="workspace-title">ACME WORKSPACE</div>
      <div className="workspace-meta">4 projects / local helper on</div>

      <ProjectsBar
        sessions={sessions}
        loadSessions={loadSessions}
        currentSession={currentSession}
        onOpen={onOpenSession}
      />

      {/*<div className="project-row">
        <PanelsTopLeft className="project-icon" {...icon18} aria-hidden="true" />
        <strong>Onboarding Flow</strong>
        <span>2 recordings</span>
        <em>2</em>
      </div>
      <div className="project-row">
        <BookOpen className="project-icon" {...icon18} aria-hidden="true" />
        <strong>Checkout QA</strong>
        <span>Runbook ready</span>
        <em className="green">1</em>
      </div>*/}

      {/*<div className="section-label recordings-title">Recent recordings</div>*/}
      {/*recordingSeed.map((recording) => {
        const isSelected = recording.id === selectedRecordingId;
        const badge =
          isSelected && isRecording ? "Recording" : isSelected && isCompleted ? "Completed" : recording.badge;

        return (
          <button
            className={isSelected ? "recording-row active" : "recording-row"}
            key={recording.id}
            onClick={() => onSelectRecording(recording.id)}
          >
            <CircleDot
              className={
                isSelected
                  ? `status-icon red ${isRecording ? "recording-pulse" : ""}`
                  : `status-icon ${recording.tone}`
              }
              {...icon18}
              aria-hidden="true"
            />
            <strong>{recording.title}</strong>
            <span>{recording.path}</span>
            <em className={isSelected && isRecording ? "red" : recording.tone}>{badge}</em>
          </button>
        );
      })*/}

      <div className="sidebar-divider" />
      <div className="helper-card">
        <div>
          <strong>Local helper</strong>
          <span className="pill green">Ready</span>
        </div>
        <p>Mac confirmation is required before the browser recording starts.</p>
        <span className="progress">
          <i />
        </span>
      </div>
    </aside>
  );
}
