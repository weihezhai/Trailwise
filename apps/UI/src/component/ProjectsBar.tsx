import { useEffect } from "react";
import ProjectCard from "./ProjectCard";

interface ProjectsBarProps {
  sessions: Array<{ session_id: string; status: string }>;
  loadSessions: () => Promise<void> | void;
  onOpen: (session: { session_id: string; status: string }) => void;
  currentSession: { session_id: string; status?: string } | null;
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