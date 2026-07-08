
import {
  deleteSession,
  generateRunbook,
  generateSkill,
  getSessionLog,
  listSessions,
  startRecording,
  statusRecording,
  stopRecording,
  type RecordingSession,
  type SessionLog,
  type SessionLogEvent,
} from "./api/trailwise";
import MissionRail from "./component/MissionRail";
import TopBar from "./component/TopBar";
import WorkspaceSidebar from "./component/WorkspaceSidebar";
import { AnimatedTabs, type AnimatedTabItem } from "./component/ui/AnimatedTabs";
import { GridBackground } from "./component/ui/GridBackground";
import { MovingBorderButton } from "./component/ui/MovingBorderButton";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  BookOpen,
  Bot,
  CircleDot,
  Copy,
  FileCode,
  GitBranch,
  LayoutDashboard,
  Play,
  Route,
  Square,
} from "lucide-react";
import ProjectDelete from "./component/ProjectDelete";

const icon18 = { size: 18, strokeWidth: 1.75 };
const icon20 = { size: 20, strokeWidth: 1.75 };

const recordingSeed = [
  {
    id: "expense",
    title: "Expense approval",
    path: "localhost:5173/expenses",
    badge: "Awaiting",
    tone: "amber",
    actions: 0,
    duration: 0,
  },
  {
    id: "manager",
    title: "Manager review",
    path: "localhost:5173/review",
    badge: "Parsed",
    tone: "green",
    actions: 8,
    duration: 93,
  },
  {
    id: "invoice",
    title: "Invoice review",
    path: "localhost:5173/invoice...",
    badge: "Runbook",
    tone: "green",
    actions: 11,
    duration: 126,
  },
  {
    id: "policy",
    title: "Policy update",
    path: "localhost:5173/settings",
    badge: "Draft",
    tone: "amber",
    actions: 6,
    duration: 74,
  },
];

type Panel = "overview" | "trace" | "runbook" | "automation";
type RecordingPhase = "ready" | "recording" | "completed";
type WorkflowStage = "prepare" | "record" | "review" | "generate";
type LoadingAction = "skill" | "runbook" | null;
type ThemeMode = "light" | "dark";
type Toast = { id: number; message: string; tone?: "error" | "default" };
type TimelineEntry = SessionLogEvent & {
  action: string;
  description: string;
  target: string;
  time: string;
  state: string;
  stateClass: "done" | "pending" | "disabled";
  disabled: boolean;
};

const workflowActionTypes = new Set<SessionLogEvent["type"]>(["navigation", "click", "input", "submit"]);

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatEventTime(event: SessionLogEvent, startedAt?: string) {
  if (startedAt && Number.isFinite(Date.parse(startedAt))) {
    return new Date(Date.parse(startedAt) + event.ts).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  if (Number.isFinite(event.ts)) return `${Math.round(event.ts / 100) / 10}s`;
  return "--";
}

function cleanTarget(value: string | undefined | null) {
  return value?.replace(/\s+/g, " ").trim() || "";
}

function eventTarget(event: SessionLogEvent) {
  return (
    cleanTarget(event.label) ||
    cleanTarget(event.text) ||
    cleanTarget(event.element?.label) ||
    cleanTarget(event.element?.ariaLabel) ||
    cleanTarget(event.element?.placeholder) ||
    cleanTarget(event.element?.name) ||
    cleanTarget(event.element?.text) ||
    cleanTarget(event.selector) ||
    cleanTarget(event.url) ||
    "recorded element"
  );
}

function quoted(value: string) {
  return value.startsWith("http") || value.includes("[") || value.includes("=") ? value : `"${value}"`;
}

function eventDescription(event: SessionLogEvent) {
  const target = eventTarget(event);
  if (event.type === "input") {
    const value = event.value_policy === "redacted" ? "[REDACTED]" : event.value || "[TYPED_TEXT]";
    return `Entered ${quoted(value)} into ${quoted(target)}`;
  }
  if (event.type === "click") return `Clicked ${quoted(target)}`;
  if (event.type === "submit") return `Submitted ${quoted(target)}`;
  if (event.type === "navigation") return `Navigated to ${event.url || target}`;
  return `${event.type.replace(/_/g, " ")} ${target}`;
}

function buildSkillText(sessionId: string | undefined, entries: TimelineEntry[]) {
  const includedEntries = entries.filter((entry) => !entry.disabled);
  const lines = [
    `name: trailwise-recorded-${sessionId || "session"}`,
    "description: Replay the recorded browser workflow from the selected Trailwise session.",
    "",
    "# Trailwise Session Skill",
    "",
    "Use this skill to replay the recorded action log. Target business records remain in the original website.",
    "",
    "## Action Log",
  ];

  if (!includedEntries.length) {
    lines.push("- No enabled recorded actions are available yet.");
  } else {
    for (const [index, entry] of includedEntries.entries()) {
      lines.push(`${index + 1}. ${entry.description}`);
    }
  }

  return lines.join("\n");
}

export default function App() {
    const [themeMode] = useState<ThemeMode>(() => {
      try {
        return localStorage.getItem("trailwise-theme") === "dark" ? "dark" : "light";
      } catch {
        return "light";
      }
    });
  const [, setMessage] = useState("");
  const [, setProjectName] = useState("CREATE YOUR PROJECT");
  const [currentSession, setCurrentSession] = useState<RecordingSession | null>(null);
  const [sessions, setSessions] = useState<RecordingSession[]>([]);
  const [sessionLog, setSessionLog] = useState<SessionLog | null>(null);
  const [logLoading, setLogLoading] = useState(false);
  const [logError, setLogError] = useState("");
  const [disabledSteps, setDisabledSteps] = useState<Record<number, boolean>>({});

    const [activePanel, setActivePanel] = useState<Panel>("overview");
  const [selectedStep, setSelectedStep] = useState(0);
    const [recordingPhase, setRecordingPhase] = useState<RecordingPhase>("ready");
    const [durationSeconds, setDurationSeconds] = useState(recordingSeed[0].duration);
    const [actionsCaptured, setActionsCaptured] = useState(recordingSeed[0].actions);
    const [loadingAction, setLoadingAction] = useState<LoadingAction>(null);
    const [generatedArtifacts, setGeneratedArtifacts] = useState({ skill: false, runbook: false });
    const [generatedSkillPath, setGeneratedSkillPath] = useState("");
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [copied, setCopied] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [targetUrl, setTargetUrl] = useState("http://localhost:5173");
    const summaryRef = useRef<HTMLElement>(null);
    const timelineRef = useRef<HTMLElement>(null);
    const runbookRef = useRef<HTMLElement>(null);
    const automationRef = useRef<HTMLElement>(null);
    const [memoryConfirmed, setMemoryConfirmed] = useState(false);
  
  
  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    try {
      localStorage.setItem("trailwise-theme", themeMode);
    } catch {
      // Ignore storage failures in restricted desktop shells.
    }
  }, [themeMode]);

  const timelineEntries: TimelineEntry[] = (sessionLog?.events ?? [])
    .filter((event) => workflowActionTypes.has(event.type))
    .map((event) => {
      const disabled = Boolean(disabledSteps[event.seq]);
      return {
        ...event,
        action: eventDescription(event),
        description: eventDescription(event),
        target: eventTarget(event),
        time: formatEventTime(event, sessionLog?.started_at),
        state: disabled ? "Disabled" : "Included",
        stateClass: disabled ? "disabled" : "done",
        disabled,
      };
    });
  const selectedEvent = timelineEntries.find((event) => event.seq === selectedStep) ?? timelineEntries[0] ?? null;
  const includedActionCount = timelineEntries.filter((event) => !event.disabled).length;
  const skillText = buildSkillText(currentSession?.session_id, timelineEntries);
  const sessionStatus = currentSession?.status?.toLowerCase() ?? "";
  const isSessionRecording = sessionStatus.includes("recording");
  const isSessionCompleted = /completed|finished|recorded|stop|stopped|stopping/.test(sessionStatus);
  const isRecording = sessionStatus ? isSessionRecording : recordingPhase === "recording";
  const isCompleted = sessionStatus ? isSessionCompleted : recordingPhase === "completed";
  const statusLabel = currentSession?.status
    ? currentSession.status.replace(/\b\w/g, (char) => char.toUpperCase())
    : recordingPhase === "recording"
      ? "Recording"
      : recordingPhase === "completed"
        ? "Completed"
        : "Ready";
  
const workflowStage: WorkflowStage =
  memoryConfirmed
    ? "generate"
    : sessionStatus.includes("pending")
    ? "record"
    : sessionStatus.includes("recording")
    ? "record"
    : sessionStatus.includes("stop") ||
      sessionStatus.includes("stopped") ||
      sessionStatus.includes("recorded") ||
      sessionStatus.includes("finished") ||
      sessionStatus.includes("completed")
    ? "review"
    : "prepare";

    const stageCopy: Record<WorkflowStage, { eyebrow: string; title: string; body: string; status: string }> = {
      prepare: {
        eyebrow: "Step 1 / Record",
        title: "Start a browser workflow recording.",
        body: "Enter a target URL, then record one complete workflow so Trailwise can structure it into reusable memory.",
        status: "Ready to record",
      },
      record: {
        eyebrow: "Step 2 / Capture",
        title: "Capturing actions and screen changes.",
        body: "Mouse, keyboard, timing, and visible state changes become a synchronized workflow trace.",
        status: "Recording in progress",
      },
      review: {
        eyebrow: "Step 3 / Structure",
        title: "Review the structured workflow memory.",
        body: "Confirm the initial state, captured steps, and expected result before saving this workflow memory.",
        status: "Ready for review",
      },
      generate: {
        eyebrow: "Step 4 / Reuse",
        title: "Use this workflow memory.",
        body: "Generate human-readable outputs or start a background robot run from the confirmed workflow.",
        status: "Workflow memory saved",
      },
    };
    const workflowSteps: Array<{ id: WorkflowStage; label: string; detail: string }> = [
      { id: "prepare", label: "Record", detail: "target and helper" },
      { id: "record", label: "Capture", detail: "actions and frames" },
      { id: "review", label: "Review", detail: "structured memory" },
      { id: "generate", label: "Use", detail: "outputs and robot" },
    ];
    const workflowStageIndex = workflowSteps.findIndex((step) => step.id === workflowStage);
    const mainTabs: AnimatedTabItem[] = [
      { id: "overview", label: "Record", icon: <LayoutDashboard {...icon18} aria-hidden="true" /> },
      {
        id: "trace",
        label: "Review memory",
        icon: <Route {...icon18} aria-hidden="true" />,
        disabled: !isCompleted,
      },
      {
        id: "runbook",
        label: "Outputs",
        icon: <BookOpen {...icon18} aria-hidden="true" />,
        disabled: !memoryConfirmed,
      },
      {
        id: "automation",
        label: "Robot run",
        icon: <Bot {...icon18} aria-hidden="true" />,
        disabled: !memoryConfirmed,
      },
    ];
    useEffect(() => {
      if (!isRecording) return undefined;
  
      const intervalId = window.setInterval(() => {
        setDurationSeconds((current) => current + 1);
      }, 1000);
  
      return () => window.clearInterval(intervalId);
    }, [isRecording]);

    useEffect(() => {
      if (!currentSession?.session_id) {
        setSessionLog(null);
        setDisabledSteps({});
        setSelectedStep(0);
        return;
      }

      void loadSessionLog(currentSession.session_id, { silent: true });
    }, [currentSession?.session_id]);

    useEffect(() => {
      if (!currentSession?.session_id || !isRecording) return undefined;

      const intervalId = window.setInterval(() => {
        void loadSessionLog(currentSession.session_id, { silent: true });
      }, 2000);

      return () => window.clearInterval(intervalId);
    }, [currentSession?.session_id, isRecording]);
  
    const showToast = (message: string, tone: Toast["tone"] = "default") => {
      const id = Date.now();
      setToasts((current) => [...current, { id, message, tone }]);
      window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }, tone === "error" ? 3200 : 1800);
    };

  async function loadSessionLog(sessionId: string, options: { silent?: boolean } = {}) {
    if (!options.silent) setLogLoading(true);
    setLogError("");

    try {
      const data = await getSessionLog(sessionId);
      const actionEvents = data.events.filter((event) => workflowActionTypes.has(event.type));

      setSessionLog(data);
      setActionsCaptured(actionEvents.length);
      if (typeof data.duration_ms === "number") {
        setDurationSeconds(Math.round(data.duration_ms / 1000));
      }
      if (actionEvents.length) {
        setSelectedStep((current) =>
          actionEvents.some((event) => event.seq === current) ? current : actionEvents[0].seq,
        );
      } else {
        setSelectedStep(0);
      }
      if (data.session) {
        setCurrentSession((session) =>
          session?.session_id === data.session_id ? { ...session, ...data.session, status: data.status } : session,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load session log";
      setLogError(message);
      if (!options.silent) showToast(message, "error");
    } finally {
      if (!options.silent) setLogLoading(false);
    }
  }
  
  const openProjectSession = async (session: RecordingSession) => {
    try {
      const result = await statusRecording(session.session_id);
      const statusText = result?.text ?? "";
      const matched = statusText.match(/status[:\s]+([\w\s]+)/i) || statusText.match(/(pending|running|completed|ready|recording|stopped|failed|cancelled|finished|generated|generate|recorded)/i);
      const freshStatus = (matched?.[1] ?? session.status).trim();
      const normalizedStatus = freshStatus.toLowerCase();
      const isGenerated = /generated|generate|saved/.test(normalizedStatus);
      const isReview = /finished|recorded|completed|stop|stopped|stopping/.test(normalizedStatus);
      const isRecordPhase = /pending|recording|ready/.test(normalizedStatus);

      if (isGenerated) {
        setRecordingPhase("completed");
        setMemoryConfirmed(true);
      } else if (isReview) {
        setRecordingPhase("completed");
        setMemoryConfirmed(false);
      } else if (isRecordPhase) {
        setRecordingPhase(normalizedStatus.includes("recording") ? "recording" : "ready");
        setMemoryConfirmed(false);
      }

      const panelForStatus: Panel = normalizedStatus.includes("pending")
        ? "overview"
        : normalizedStatus.includes("recording")
          ? "overview"
          : normalizedStatus.includes("stop") || normalizedStatus.includes("stopping")
            ? "trace"
            : normalizedStatus.includes("finished") || normalizedStatus.includes("recorded") || normalizedStatus.includes("completed")
              ? "trace"
              : normalizedStatus.includes("generated") || normalizedStatus.includes("generate") || normalizedStatus.includes("saved")
                ? "automation"
                : "overview";

      setCurrentSession({ ...session, status: freshStatus });
      setProjectName(session.session_id);
      if (session.target_url) setTargetUrl(session.target_url);
      setActivePanel(panelForStatus);
      setSidebarOpen(false);
      showToast(`Loaded ${session.session_id} (${freshStatus}) - opened ${panelForStatus}`);
      await loadSessionLog(session.session_id);
      await loadSessions();
    } catch (error) {
      console.error("Failed to fetch session status", error);
      setCurrentSession(session);
      setActivePanel("overview");
      showToast(`Loaded ${session.session_id} (status unknown)`, "error");
    }
  };
  
  const jumpTo = (panel: Panel) => {
    const target = {
      overview: summaryRef,
      trace: timelineRef,
      runbook: runbookRef,
      automation: automationRef,
    }[panel];

    setActivePanel(panel);
    window.setTimeout(() => target.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

    const confirmMemory = async () => {
    if (!isCompleted) {

      showToast("Complete the recording before confirming memory");
      return;
    }
    
    if (currentSession?.session_id) {
      await loadSessionLog(currentSession.session_id);
    }
    setMemoryConfirmed(true);
    setActivePanel("trace");
    showToast("Session action log confirmed");
    };
  
    const checkStatus = () => {
      showToast(`${statusLabel}: ${formatDuration(durationSeconds)} / ${actionsCaptured} actions captured`);
    };
  
    const openWorkspace = () => {
      setSidebarOpen(false);
      jumpTo("overview");
    };
  
      const openSettings = () => {
      showToast("Settings are not connected in this prototype");
    };
  
    const generateArtifact = async (kind: Exclude<LoadingAction, null>) => {
      if (!isCompleted || !currentSession?.session_id || loadingAction) return;

      setLoadingAction(kind);
      try {
        const result = kind === "skill"
          ? await generateSkill(currentSession.session_id)
          : await generateRunbook(currentSession.session_id);

        setGeneratedArtifacts((current) => ({ ...current, [kind]: true }));
        if (kind === "skill") {
          setGeneratedSkillPath(result.artifactPath ?? "");
        }
        showToast(kind === "skill" ? "Skill generated from session log" : "Runbook generated from session log");
        jumpTo("runbook");
        await loadSessions();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Generation failed";
        showToast(message, "error");
      } finally {
        setLoadingAction(null);
      }
    };

  const toggleSidebar = () => {
    setSidebarOpen((current) => !current);
  };

  const toggleStepDisabled = (seq: number) => {
    setDisabledSteps((current) => ({
      ...current,
      [seq]: !current[seq],
    }));
  };

  const deleteCurrentSession = async (session: { session_id: string }) => {
    try {
      await deleteSession(session.session_id);
      setCurrentSession(null);
      setSessionLog(null);
      setMemoryConfirmed(false);
      setRecordingPhase("ready");
      await loadSessions();
      showToast(`Deleted ${session.session_id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Delete failed";
      showToast(message, "error");
    }
  };

  const copyRunbook = async () => {
    try {
      await navigator.clipboard.writeText(skillText);
    } catch {
      // The visual acknowledgement still helps when clipboard access is blocked.
    }

    setCopied(true);
    showToast("Reusable skill copied");
    window.setTimeout(() => setCopied(false), 1200);
  };

  const loadSessions = useCallback(async () => {
    const data = await listSessions();
    const visibleSessions = data.filter((session) => session.status !== "deleted");
    setSessions(visibleSessions);
    return visibleSessions;
  }, []);


   const beginRecording = async () => {
    if (isRecording) return;
    try {
          const result = await startRecording(targetUrl);
    
          console.log(result);
    
          setMessage(result.text ?? JSON.stringify(result));
    
          const activeSessions = await loadSessions();
    
          const match = result.text?.match(/Session:\s*(\S+)/);
          const sessionId = result.session_id ?? match?.[1];
    
          if (sessionId) {
            const newSession = activeSessions.find((session) => session.session_id === sessionId);
    
            if (newSession) {
              setCurrentSession(newSession);
              setProjectName(newSession.session_id);
            } else {
              setCurrentSession({
                session_id: sessionId,
                status: "pending_local_confirmation",
                target_url: targetUrl,
              });
              setProjectName(sessionId);
            }

            setRecordingPhase("recording");
            setDurationSeconds(0);
            setActionsCaptured(0);
            setDisabledSteps({});
            setSelectedStep(0);
            jumpTo("overview");
            showToast("Recording started");
          }
    
          if (result.text?.[0] === "R") {
            window.open(targetUrl, "_blank");
          }
        } catch (err) {
          console.error(err);
          setMessage("Start failed");
        }
  };

  const handleStop = async () => {
    if (!currentSession) return;
    try {
        const result = await stopRecording(currentSession.session_id);

        console.log(result);
        setMessage(result.text ?? JSON.stringify(result));
        setRecordingPhase("completed");
        setCurrentSession((session) => (session ? { ...session, status: "stopping" } : session));
        jumpTo("trace");
        showToast("Recording completed");
        await loadSessionLog(currentSession.session_id, { silent: true });
        await loadSessions();
      } catch (err) {
        console.error(err);
        setMessage("Stop failed");
      }
  };



    const openPanel = (panel: Panel) => {
    if (panel === "trace" && !isCompleted) {
      showToast("Record a workflow before reviewing memory");
      return;
    }

    if ((panel === "runbook" || panel === "automation") && !memoryConfirmed) {
      showToast("Confirm workflow memory before using it");
      return;
    }

    jumpTo(panel);
  };

    const queueAutomation = () => {
    if (!isCompleted || !memoryConfirmed) {
      showToast("Confirm workflow memory before starting the robot run");
      return;
    }

    showToast(`Robot run queued with ${includedActionCount} enabled actions`);
  };

  return (
    <main className="screen-shell" aria-label="Trailwise 09 console preview">
      <section className={`console-screen ${sidebarOpen ? "sidebar-open" : ""}`}>
        <MissionRail
          activePanel={activePanel}
          sidebarOpen={sidebarOpen}
          onOpenWorkspace={openWorkspace}
          onToggleSidebar={toggleSidebar}
          onJumpTo={jumpTo}
          onOpenSettings={openSettings}
        />

        <TopBar sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} />


        <button
          className="sidebar-backdrop"
          aria-label="Close workspace sidebar"
          onClick={() => setSidebarOpen(false)}
          type="button"
        />
        <WorkspaceSidebar
          sessions={sessions}
          currentSession={currentSession}
          loadSessions={loadSessions}
          onOpenSession={openProjectSession}
        />

        <section className="workspace">
          <div className="header-surface" />
          <div className="header-grid" />
          <GridBackground className="workspace-grid-background" />
          <div className="breadcrumb">Trailwise / Projects / Expense Approval / Trace detail</div>
          <div className="title-icon">
            <GitBranch {...icon20} aria-hidden="true" />
          </div>

          <div className="title-row">
            <h1>Record {currentSession?.session_id || "New"} workflow</h1>
            <span className={isRecording ? "pill red" : isCompleted ? "pill green" : "pill amber"}>
              {statusLabel}
            </span>
            <span className={isCompleted ? "pill green" : "pill amber"}>
              {memoryConfirmed ? "Memory saved" : isCompleted ? "Review memory" : "Not recorded yet"}
            </span>
          </div>
          {currentSession && (
            <div className="session-status-row">
              <span>Session status: {currentSession.status ?? "Unknown"}</span>
            </div>
          )}
          <ProjectDelete session={currentSession} onDelete={deleteCurrentSession} />
          <AnimatedTabs activeId={activePanel} items={mainTabs} onChange={(panel) => openPanel(panel as Panel)} />


          <div className={`content-grid panel-${activePanel}`}>
            <div className="primary-column">
              {activePanel === "overview" && (
                <article className={`summary-card stage-${workflowStage} ${isRecording ? "is-live" : ""}`} ref={summaryRef}>
                  <div className="phase-strip" aria-label="Workflow progress">
                    {workflowSteps.map((step, index) => {
                      const stepState =
                        index < workflowStageIndex ? "complete" : index === workflowStageIndex ? "active" : "future";
                      return (
                        <button
                          className={`phase-step ${stepState}`}
                          disabled={stepState === "future"}
                          key={step.id}
                          onClick={() => {
                            if (step.id === "prepare") jumpTo("overview");
                            if (step.id === "record") jumpTo("overview");
                            if (step.id === "review") openPanel("trace");
                            if (step.id === "generate") openPanel("runbook");
                          }}
                          type="button"
                        >
                          <span>{index + 1}</span>
                          <strong>{step.label}</strong>
                          <em>{step.detail}</em>
                        </button>
                      );
                    })}
                  </div>
                  <div className="stage-header">
                    <div>
                      <span className="stage-eyebrow">{stageCopy[workflowStage].eyebrow}</span>
                      <h2>{stageCopy[workflowStage].title}</h2>
                      <p>{stageCopy[workflowStage].body}</p>
                    </div>
                    <span className={`stage-status ${isRecording ? "red recording-pulse" : isCompleted ? "green" : ""}`}>
                      <CircleDot {...icon18} aria-hidden="true" />
                      {stageCopy[workflowStage].status}
                    </span>
                  </div>
                  <div className="guided-stage-grid">
                    <div className="guided-stage-primary">
                      {workflowStage === "prepare" && (
                        <div className="target-capture-panel">
                          <label className="guided-url-field">
                            <span>Target URL</span>
                            <input
                              aria-label="Target URL"
                              value={targetUrl}
                              onChange={(event) => setTargetUrl(event.target.value)}
                              placeholder="http://localhost:5173"
                            />
                          </label>
                          <div className="helper-inline">
                            <CircleDot {...icon18} aria-hidden="true" />
                            <div>
                              <strong>Local helper ready</strong>
                              <span>Chrome recording will start after local confirmation.</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {workflowStage === "record" && (
                        <div className="target-capture-panel live-capture-panel">
                          <div className="live-indicator">
                            <CircleDot className="recording-pulse" {...icon18} aria-hidden="true" />
                            <div>
                              <strong>Recording browser workflow</strong>
                              <span>Demonstrate the full path once, then stop to structure memory.</span>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="metrics">
                        <div>
                          <span>Status</span>
                          <strong className={isRecording ? "red-text" : isCompleted ? "green-text" : ""}>
                            {statusLabel}
                          </strong>
                        </div>
                        <div>
                          <span>Duration</span>
                          <strong>{formatDuration(durationSeconds)}</strong>
                        </div>
                        <div>
                          <span>Actions captured</span>
                          <strong>{actionsCaptured}</strong>
                        </div>
                        <div>
                          <span>Session</span>
                          <strong>Active</strong>
                        </div>
                      </div>

                      {isCompleted ? (
                        <div className="learned-memory-panel">
                          <div className="learned-head">
                            <div>
                              <span>WHAT TRAILWISE LEARNED</span>
                              <h3>This workflow can be replayed from one session action log.</h3>
                            </div>
                            <span className={memoryConfirmed ? "pill green" : "pill amber"}>
                              {memoryConfirmed ? "Confirmed" : "Needs review"}
                            </span>
                          </div>
                          <ol>
                            <li>
                              <strong>Initial state</strong>
                              <span>Open {sessionLog?.target_url || targetUrl} with the local helper connected.</span>
                            </li>
                            <li>
                              <strong>Operating path</strong>
                              <span>{includedActionCount || actionsCaptured} recorded actions are available for replay review.</span>
                            </li>
                            <li>
                              <strong>Expected result</strong>
                              <span>The log describes what was clicked, typed, and submitted during this run.</span>
                            </li>
                          </ol>
                        </div>
                      ) : (
                        <div className="memory-entry-card">
                          <div>
                            <span>Workflow memory</span>
                              <strong>{memoryConfirmed ? "Target URL and local helper ready" : "Waiting for recording"}</strong>
                          </div>
                          <div>
                            <span>Initial state</span>
                            <strong>{currentSession ? "Target URL and local helper ready" : "Waiting for session"}</strong>
                          </div>
                          <div>
                            <span>Stage result</span>
                            <strong>Record one successful workflow path</strong>
                          </div>
                        </div>
                      )}

                      <div className="stage-action-bar">
                        {workflowStage === "prepare" && (
                          <>
                            <MovingBorderButton className="btn dark primary-action" onClick={beginRecording}>
                              Start recording <Play {...icon18} aria-hidden="true" />
                            </MovingBorderButton>
                            <button className="btn light" onClick={checkStatus}>
                              Check helper <Activity {...icon18} aria-hidden="true" />
                            </button>
                          </>
                        )}
                        {workflowStage === "record" && (
                          <>
                            <MovingBorderButton className="btn dark primary-action" onClick={handleStop}>
                              Stop and structure memory <Square {...icon18} aria-hidden="true" />
                            </MovingBorderButton>
                            <button className="btn light" onClick={checkStatus}>
                              Live status <Activity {...icon18} aria-hidden="true" />
                            </button>
                          </>
                        )}
                        {workflowStage === "review" && (
                          <>
                            <MovingBorderButton className="btn dark primary-action" onClick={confirmMemory}>
                              Confirm memory <CircleDot {...icon18} aria-hidden="true" />
                            </MovingBorderButton>
                            <button className="btn light" onClick={() => openPanel("trace")}>
                              Inspect details <Route {...icon18} aria-hidden="true" />
                            </button>
                          </>
                        )}
                        {workflowStage === "generate" && (
                          <>
                            <MovingBorderButton className="btn dark primary-action" onClick={queueAutomation}>
                              Run robot <Bot {...icon18} aria-hidden="true" />
                            </MovingBorderButton>
                            <button
                              className={loadingAction === "runbook" ? "btn light loading" : "btn light"}
                              disabled={loadingAction !== null}
                              onClick={() => (generatedArtifacts.runbook ? openPanel("runbook") : void generateArtifact("runbook"))}
                            >
                              {generatedArtifacts.runbook ? "Open output" : "Generate Runbook"} <BookOpen {...icon18} aria-hidden="true" />
                            </button>
                            <button
                              className={loadingAction === "skill" ? "btn light loading" : "btn light"}
                              disabled={loadingAction !== null}
                              onClick={() => void generateArtifact("skill")}
                            >
                              Generate Skill <FileCode {...icon18} aria-hidden="true" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <aside className="workflow-preview-panel">
                      <span>{workflowStage === "generate" ? "READY TO REUSE" : "WHAT TRAILWISE CAPTURES"}</span>
                      <h3>
                        {workflowStage === "generate"
                          ? "This memory can now guide people or a robot run."
                          : workflowStage === "review"
                            ? "Confirm the summary instead of reading every event."
                            : "Record once, then reuse the workflow later."}
                      </h3>
                      <ul>
                        <li>{workflowStage === "generate" ? "Run the automation robot" : "Browser actions and timing"}</li>
                        <li>{workflowStage === "generate" ? "Generate Runbook or Test Case" : "Key screen states and stage results"}</li>
                        <li>{workflowStage === "generate" ? "Pause for human handoff when needed" : "Sensitive input redaction"}</li>
                      </ul>
                    </aside>
                  </div>
                  <div className="trust-strip">
                    <span>{isCompleted ? "Keyframes extracted" : "Target URL ready"}</span>
                    <span>{isCompleted ? "Stage results" : "Local helper ready"}</span>
                    <span>{memoryConfirmed ? "Memory saved" : isCompleted ? "Review required" : "Ready to record"}</span>
                  </div>
                </article>
              )}

              {activePanel === "trace" && (
                <article
                  className={`timeline-card ${
                    workflowStage === "record" || workflowStage === "review" ? "is-emphasized" : "is-secondary"
                  }`}
                  ref={timelineRef}
                >
                  <h2>Review structured memory</h2>
                  <p>Session {currentSession?.session_id ?? "not selected"} shows what the AI/user did, not business records from the target website.</p>
                  {logError && <div className="log-empty-state error">{logError}</div>}
                  <div className="timeline-layout">
                    <div className="table">
                      <div className="table-head">
                        <span>Step</span>
                        <span>Action</span>
                        <span>State</span>
                        <span>Time</span>
                        <span>Replay</span>
                      </div>
                      {logLoading && <div className="log-empty-state">Loading session log...</div>}
                      {!logLoading && !timelineEntries.length && (
                        <div className="log-empty-state">
                          {currentSession
                            ? "No recorded click, input, submit, or navigation actions are available for this session yet."
                            : "Start or select a session to review its action log."}
                        </div>
                      )}
                      {timelineEntries.map((event, index) => (
                        <div
                          className={`${selectedStep === event.seq ? "table-row selected" : "table-row"} ${event.disabled ? "disabled" : ""}`}
                          key={event.seq}
                          onClick={() => setSelectedStep(event.seq)}
                          onKeyDown={(keyboardEvent) => {
                            if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
                              keyboardEvent.preventDefault();
                              setSelectedStep(event.seq);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                        >
                          <span>{index + 1}</span>
                          <strong>{event.action}</strong>
                          <em className={event.stateClass}>{selectedStep === event.seq ? "Selected" : event.state}</em>
                          <span>{event.time}</span>
                          <button
                            className="step-toggle"
                            onClick={(clickEvent) => {
                              clickEvent.stopPropagation();
                              toggleStepDisabled(event.seq);
                            }}
                            type="button"
                          >
                            {event.disabled ? "Enable" : "Disable"}
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flow-map">
                      <span>Stage map</span>
                      <em className={selectedEvent?.type === "navigation" ? "active" : ""}>Nav</em>
                      <em className={selectedEvent?.type === "input" ? "active" : ""}>Input</em>
                      <em className={selectedEvent?.type === "click" || selectedEvent?.type === "submit" ? "active" : ""}>Action</em>
                      <em className={memoryConfirmed ? "active" : ""}>Reuse</em>
                    </div>
                  </div>
                  <div className="trace-next-step">
                    <div>
                      <span>NEXT STEP</span>
                      <h3>{memoryConfirmed ? "Generate outputs from workflow memory" : "Confirm the memory summary first"}</h3>
                      <p>
                        {memoryConfirmed
                          ? "Create a replayable skill from the enabled actions in this session log."
                          : "Return to the guided flow and save the structured workflow before generating outputs."}
                      </p>
                    </div>
                    <button
                      className={loadingAction === "skill" ? "btn dark loading" : "btn dark"}
                      disabled={loadingAction !== null}
                      onClick={() =>
                        memoryConfirmed
                          ? generatedArtifacts.skill
                            ? openPanel("runbook")
                            : void generateArtifact("skill")
                          : confirmMemory()
                      }
                    >
                      {loadingAction === "skill"
                        ? "Generating"
                        : generatedArtifacts.skill
                          ? "Open Skill"
                          : memoryConfirmed
                            ? "Generate Skill"
                            : "Confirm memory"}{" "}
                      <FileCode {...icon18} aria-hidden="true" />
                    </button>
                  </div>
                </article>
              )}

              {activePanel === "runbook" && (
                <article
                  className={`runbook-card ${workflowStage === "generate" ? "is-emphasized" : "is-secondary"}`}
                  ref={runbookRef}
                >
                  <div className="card-head">
                    <div>
                      <h2>Skill from session action log</h2>
                      <p>{includedActionCount} enabled actions from session {currentSession?.session_id ?? "not selected"}. Target business records stay in the target website.</p>
                      {generatedSkillPath && <span className="artifact-path">{generatedSkillPath}</span>}
                    </div>
                    <button className="btn light" disabled={!memoryConfirmed} onClick={copyRunbook}>
                      Copy skill <Copy {...icon18} aria-hidden="true" />
                    </button>
                  </div>
                  <div className="code-panel">
                    <div className="code-tabs">
                      <span>session_log.json</span>
                      <span>SKILL.md</span>
                      <button aria-label="Copy" className={copied ? "copied" : ""} onClick={copyRunbook}>
                        <Copy {...icon18} aria-hidden="true" />
                      </button>
                    </div>
                    <pre>{skillText}</pre>
                  </div>
                </article>
              )}

              {activePanel === "automation" && (
                <article className="automation-card is-emphasized" ref={automationRef}>
                  <div className="card-head">
                    <div>
                      <span className="eyebrow">BACKGROUND AUTOMATION</span>
                      <h2>Automation robot operator</h2>
                      <p>Start a guided robot run from the confirmed workflow memory. Trailwise stays in the background and asks only when handoff is needed.</p>
                    </div>
                    <span className={isCompleted ? "pill green" : "pill amber"}>
                      {isCompleted ? "Ready" : "Waiting"}
                    </span>
                  </div>

                  <div className="automation-grid">
                    <div>
                      <GitBranch {...icon18} aria-hidden="true" />
                      <strong>Workflow memory</strong>
                      <span>{isCompleted ? `${includedActionCount} enabled actions from one session log` : "Waiting for structured memory"}</span>
                    </div>
                    <div>
                      <Bot {...icon18} aria-hidden="true" />
                      <strong>Robot control</strong>
                      <span>{isCompleted ? "Plan, operate, verify, report" : "Paused until memory is ready"}</span>
                    </div>
                    <div>
                      <Activity {...icon18} aria-hidden="true" />
                      <strong>Human handoff</strong>
                      <span>Stops for login, CAPTCHA, permissions, or confirmation</span>
                    </div>
                  </div>

                  <div className="automation-footer">
                    <button className="btn dark primary-action" disabled={!isCompleted} onClick={queueAutomation}>
                      Queue robot run <Bot {...icon18} aria-hidden="true" />
                    </button>
                    <button className="btn light" onClick={checkStatus}>
                      Check readiness <Activity {...icon18} aria-hidden="true" />
                    </button>
                  </div>
                </article>
              )}
            </div>

            {activePanel === "trace" && (
            <aside className={`inspector ${workflowStage === "prepare" ? "is-secondary" : ""}`}>
              <div className="eyebrow">MEMORY DETAIL</div>
              <div className="inspector-content" key={`${currentSession?.session_id ?? "none"}-${selectedStep}`}>
                <div className="inspector-title">
                  <h2>{selectedEvent?.action ?? "No action selected"}</h2>
                  <span className={selectedEvent?.disabled ? "pill amber" : "pill"}>{selectedEvent?.disabled ? "Disabled" : "Selected"}</span>
                </div>
                <p>
                  {selectedEvent
                    ? `Event ${selectedEvent.seq} from session ${currentSession?.session_id ?? "unknown"}.`
                    : "Select a recorded action to inspect the session log entry."}
                </p>

                {selectedEvent && (
                  <div className="inspector-section">
                    <div className="section-head">
                      <h3>Action properties</h3>
                      <button className="step-toggle" onClick={() => toggleStepDisabled(selectedEvent.seq)} type="button">
                        {selectedEvent.disabled ? "Enable replay" : "Disable replay"}
                      </button>
                    </div>
                    <dl>
                      <dt>Action type</dt>
                      <dd>{selectedEvent.type}</dd>
                      <dt>Target</dt>
                      <dd>{selectedEvent.target}</dd>
                      <dt>Selector</dt>
                      <dd>{selectedEvent.selector || selectedEvent.element?.selector || "--"}</dd>
                      <dt>Input value</dt>
                      <dd>{selectedEvent.type === "input" ? selectedEvent.value || selectedEvent.value_policy || "--" : "--"}</dd>
                      <dt>Page URL</dt>
                      <dd>{selectedEvent.url || sessionLog?.target_url || targetUrl}</dd>
                      <dt>Timestamp</dt>
                      <dd>{selectedEvent.time}</dd>
                    </dl>
                  </div>
                )}

                <div className="inspector-section">
                  <div className="section-head">
                    <h3>Local handoff</h3>
                    <span className={isRecording ? "pill red" : "pill amber"}>
                      {isRecording ? "Recording" : "Awaiting"}
                    </span>
                  </div>
                  <dl>
                    <dt>Device</dt>
                    <dd>Sun Junxiao MacBook Pro</dd>
                    <dt>Target</dt>
                    <dd>{targetUrl}</dd>
                    <dt>Session</dt>
                    <dd>{currentSession?.session_id ?? "--"}</dd>
                  </dl>
                </div>
              </div>

              <button className="btn dark block" disabled={isRecording} onClick={beginRecording}>
                Start another recording <Play {...icon18} aria-hidden="true" />
              </button>
            </aside>
            )}
          </div>
        </section>
      </section>

      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div className={toast.tone === "error" ? "toast error" : "toast"} key={toast.id}>
            {toast.message}
          </div>
        ))}
      </div>
    </main>
          
  );
}
