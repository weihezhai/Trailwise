interface ProjectDeleteProps {
  session: { session_id: string } | null;
  onDelete: (session: { session_id: string }) => void;
}

export default function ProjectDelete({ session, onDelete }: ProjectDeleteProps) {
  if (!session) return null;

  return (
    <button className="btn red" onClick={() => onDelete(session)}>
      Delete
    </button>
  );
}
