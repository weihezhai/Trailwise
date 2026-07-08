import { useEffect } from "react";
import ProjectCard from "./ProjectCard";

interface SidebarSession {
  session_id: string;
  status: string;
  target_url?: string;
}

interface ProjectsBarProps {
  sessions: SidebarSession[];
  loadSessions: () => Promise<unknown> | unknown;
  onOpen: (session: SidebarSession) => void;
  currentSession: SidebarSession | null;
}

export default function ProjectsBar({
  sessions,
  loadSessions,
  onOpen,
  currentSession,
}: ProjectsBarProps) {
  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  return (
    <div>
      <div className="section-label">Projects</div>

      {sessions.map((session) => (
      <ProjectCard
        key={session.session_id}
        session={session}
        selected={
          currentSession?.session_id === session.session_id
        }
        onOpen={() => onOpen(session)}
      />
    ))}
    </div>
  );
}
