import { BookOpen, LayoutDashboard, Route, Settings } from "lucide-react";

const icon20 = { size: 20, strokeWidth: 1.75 };

type Panel = "overview" | "trace" | "runbook" | "automation";

interface MissionRailProps {
  activePanel: Panel;
  sidebarOpen: boolean;
  onOpenWorkspace: () => void;
  onToggleSidebar: () => void;
  onJumpTo: (panel: Panel) => void;
  onOpenSettings: () => void;
}

export default function MissionRail({
  activePanel,
  sidebarOpen,
  onOpenWorkspace,
  onToggleSidebar,
  onJumpTo,
  onOpenSettings,
}: MissionRailProps) {
  return (
    <aside className="mission-rail" aria-label="Primary navigation">
      <div className="account-avatar">AK</div>
      <div className="rail-rule" />
      <div className="orbit" />

      <button
        className={activePanel === "overview" ? "rail-item active" : "rail-item"}
        aria-label="Workspace"
        onClick={onOpenWorkspace}
      >
        <LayoutDashboard {...icon20} aria-hidden="true" />
      </button>
      <button
        className={sidebarOpen ? "rail-item item-2 active" : "rail-item item-2"}
        aria-label={sidebarOpen ? "Collapse sidebar" : "Open sidebar"}
        onClick={onToggleSidebar}
      >
        <Settings {...icon20} aria-hidden="true" />
      </button>
      <button
        className={activePanel === "trace" ? "rail-item item-3 active" : "rail-item item-3"}
        aria-label="Learned memory"
        onClick={() => onJumpTo("trace")}
      >
        <Route {...icon20} aria-hidden="true" />
      </button>
      <button
        className={activePanel === "runbook" ? "rail-item item-4 active" : "rail-item item-4"}
        aria-label="Outputs"
        onClick={() => onJumpTo("runbook")}
      >
        <BookOpen {...icon20} aria-hidden="true" />
      </button>
      <button className="rail-item settings" aria-label="Settings" onClick={onOpenSettings}>
        <Settings {...icon20} aria-hidden="true" />
      </button>

      <div className="rail-brand">
        <strong>TW</strong>
        <span>Trailwise</span>
        <small>v1.0.0</small>
      </div>
    </aside>
  );
}

