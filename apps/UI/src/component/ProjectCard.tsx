interface ProjectCardProps {
    session: { session_id: string; status: string };
    selected: boolean;
    onOpen: () => void;
}

export default function ProjectCard({
    session,
    selected,
    onOpen
}: ProjectCardProps) {

    return(
        <button
            className={`project-row ${
                selected ? "active" : ""
            }`}
            onClick={onOpen}
        >
            <strong>{session.session_id}</strong>

            <span style={{ textAlign: "left" }}>{session.status}</span>
        </button>
    )

}