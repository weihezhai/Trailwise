import { PanelsTopLeft, Search } from "lucide-react";

const icon18 = { size: 18, strokeWidth: 1.75 };

interface TopBarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export default function TopBar({ sidebarOpen, onToggleSidebar }: TopBarProps) {
  return (
    <header className="topbar">
      <button
        className={sidebarOpen ? "mobile-sidebar-toggle active" : "mobile-sidebar-toggle"}
        aria-label={sidebarOpen ? "Collapse workspace sidebar" : "Open workspace sidebar"}
        onClick={onToggleSidebar}
      >
        <PanelsTopLeft {...icon18} aria-hidden="true" />
      </button>
      <img className="brand-logo" src="src/assets/trailwise-logo-exact.svg" alt="Trailwise" />
      <label className="search-box">
        <Search {...icon18} aria-hidden="true" />
        <span>Search recordings, runbooks, actions...</span>
        <kbd>Cmd K</kbd>
      </label>
      <nav className="top-nav" aria-label="Top navigation">
        <a href="#">Product</a>
        <a href="#">Runs</a>
        <a href="#">Data</a>
        <a href="#">Docs</a>
      </nav>
      <span className="pill">Helper ready</span>
    </header>
  );
}
