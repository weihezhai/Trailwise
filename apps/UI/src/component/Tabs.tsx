import { BookOpen, LayoutDashboard, Route } from "lucide-react";

const icon18 = { size: 18, strokeWidth: 1.75 };

type Panel = "overview" | "trace" | "runbook";

interface TabsProps {
  activePanel: Panel;
  onJumpTo: (panel: Panel) => void;
}

export default function Tabs({ activePanel, onJumpTo }: TabsProps) {
  return (
    <div>
      <button className={activePanel === "overview" ? "active" : ""} onClick={() => onJumpTo("overview")}>
        <LayoutDashboard {...icon18} aria-hidden="true" />
        <span>Overview</span>
      </button>
      <button className={activePanel === "trace" ? "active" : ""} onClick={() => onJumpTo("trace")}>
        <Route {...icon18} aria-hidden="true" />
        <span>Trace</span>
      </button>
      <button className={activePanel === "runbook" ? "active" : ""} onClick={() => onJumpTo("runbook")}>
        <BookOpen {...icon18} aria-hidden="true" />
        <span>Runbook</span>
      </button>
    </div>
  );
}