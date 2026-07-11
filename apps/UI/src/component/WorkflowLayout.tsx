import type { ReactNode } from "react";

interface WorkflowLayoutProps {
  children: ReactNode;
  sidebarOpen: boolean;
  sidebar: ReactNode;
  header: ReactNode;
  content: ReactNode;
}

export default function WorkflowLayout(props: WorkflowLayoutProps) {
  const { children, sidebarOpen, sidebar, header, content } = props;

  return (
    <main className="screen-shell" aria-label="Trailwise 09 console preview">
      <section className={`console-screen ${sidebarOpen ? "sidebar-open" : ""}`}>
        {children}
        {sidebar}
        <section className="workspace">
          {header}
          {content}
        </section>
      </section>
    </main>
  );
}
