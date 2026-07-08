
import { startRecording, stopRecording, statusRecording, generateTest } from "./api/trailwise";
import MissionRail from "./component/MissionRail";
import TopBar from "./component/TopBar";
import WorkspaceSidebar from "./component/WorkspaceSidebar";
import { AnimatedTabs, type AnimatedTabItem } from "./component/ui/AnimatedTabs";
import { GridBackground } from "./component/ui/GridBackground";
import { MovingBorderButton } from "./component/ui/MovingBorderButton";

import { useEffect, useRef, useState } from "react";
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

const runbookText = `1  # Expense approval workflow memory
2  Initial state: browser is open at the expenses workspace.
3  Step 1: Open the expenses list.
4  Stage result: request table is visible.
5  Step 2: Create an approval request and fill amount plus approver.
6  Stage result: request form contains the required fields.
7  Step 3: Submit and wait for success confirmation.`;

const traceEvents = [
  {
    step: 1,
    action: "Open http://localhost:5173/expenses",
    state: "Done",
    stateClass: "done",
    time: "10:24:12",
    selector: "location.href",
    result: "expenses page loaded",
  },
  {
    step: 2,
    action: "Click Create request",
    state: "Done",
    stateClass: "done",
    time: "10:24:18",
    selector: "button[data-action=create]",
    result: "request form opened",
  },
  {
    step: 3,
    action: "Enter amount and approver",
    state: "Done",
    stateClass: "done",
    time: "10:24:25",
    selector: "input[name=approval]",
    result: "approval fields populated",
  },
  {
    step: 4,
    action: "Submit approval request",
    state: "Done",
    stateClass: "done",
    time: "10:24:38",
    selector: "button[type=submit]",
    result: "waiting for success state",
  },
  {
    step: 5,
    action: "Wait for success confirmation",
    state: "Pending",
    stateClass: "pending",
    time: "--:--",
    selector: "[data-state=success]",
    result: "success confirmation pending",
  },
  {
    step: 6,
    action: "Capture result state",
    state: "Pending",
    stateClass: "pending",
    time: "--:--",
    selector: "[data-capture=result]",
    result: "result state not captured",
  },
];

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
type LoadingAction = "test" | "runbook" | null;
type ThemeMode = "light" | "dark";
type Toast = { id: number; message: string; tone?: "error" | "default" };

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export default function App() {
    const [themeMode] = useState<ThemeMode>(() => {
      try {
        return localStorage.getItem("trailwise-theme") === "dark" ? "dark" : "light";
      } catch {
        return "light";
      }
    });
  const [url] = useState("http://localhost:5173");
  const [, setMessage] = useState("");
  const [, setProjectName] = useState("CREATE YOUR PROJECT");
  const [currentSession, setCurrentSession] = useState<{ session_id: string; status?: string } | null>(null);
  const [sessions, setSessions] = useState<Array<{ session_id: string; status: string }>>([]);

    const [activePanel, setActivePanel] = useState<Panel>("overview");
    const [selectedRecordingId] = useState("expense");
    const [selectedStep, setSelectedStep] = useState(4);
    const [recordingPhase, setRecordingPhase] = useState<RecordingPhase>("ready");
    const [durationSeconds, setDurationSeconds] = useState(recordingSeed[0].duration);
    const [actionsCaptured, setActionsCaptured] = useState(recordingSeed[0].actions);
    const [loadingAction, setLoadingAction] = useState<LoadingAction>(null);
    const [generatedArtifacts, setGeneratedArtifacts] = useState({ test: false, runbook: false });
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

  const selectedRecording =
    recordingSeed.find((recording) => recording.id === selectedRecordingId) ?? recordingSeed[0];
  const selectedEvent = traceEvents.find((event) => event.step === selectedStep) ?? traceEvents[3];
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
        setActionsCaptured((current) => Math.min(current + 1, 99));
      }, 1000);
  
      return () => window.clearInterval(intervalId);
    }, [isRecording]);
  
    const showToast = (message: string, tone: Toast["tone"] = "default") => {
      const id = Date.now();
      setToasts((current) => [...current, { id, message, tone }]);
      window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }, tone === "error" ? 3200 : 1800);
    };
  
  const openProjectSession = async (session: { session_id: string; status: string }) => {
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
      setActivePanel(panelForStatus);
      setSidebarOpen(false);
      showToast(`Loaded ${session.session_id} (${freshStatus}) - opened ${panelForStatus}`);
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

    const confirmMemory = () => {
    if (!isCompleted) {

      showToast("Complete the recording before confirming memory");
      return;
    }
    
    setMemoryConfirmed(true);
    generateTest(currentSession?.session_id);
    jumpTo("overview");
    setActivePanel("trace");
    showToast("Workflow memory saved");
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
  
    const generateArtifact = (kind: Exclude<LoadingAction, null>) => {
      if (!isCompleted || loadingAction) return;

      setLoadingAction(kind);
      window.setTimeout(() => {
        setGeneratedArtifacts((current) => ({ ...current, [kind]: true }));
        setLoadingAction(null);
        showToast(kind === "test" ? "Test Case generated successfully" : "Runbook generated successfully");
        if (kind === "runbook") jumpTo("runbook");
      }, 900);
    };

  const toggleSidebar = () => {
    setSidebarOpen((current) => !current);
  };

  const copyRunbook = async () => {
    try {
      await navigator.clipboard.writeText(runbookText);
    } catch {
      // The visual acknowledgement still helps when clipboard access is blocked.
    }

    setCopied(true);
    showToast("Reusable runbook copied");
    window.setTimeout(() => setCopied(false), 1200);
  };

  async function loadSessions() {
    const res = await fetch("http://localhost:3000/dev/sessions");
    const data = await res.json();

    setSessions(data.sessions.filter((s: { status: string }) => s.status !== "deleted"));
  }


   const beginRecording = async () => {
    if (isRecording) return;
    try {
          const result = await startRecording(url);
    
          console.log(result);
    
          setMessage(result.text ?? JSON.stringify(result));
    
          await loadSessions();
    
          const match = result.text?.match(/Session:\s*(\S+)/);
          const sessionId = match?.[1];
    
          if (sessionId) {
            const res = await fetch("http://localhost:3000/dev/sessions");
            const data = await res.json();
            const newSession = data.sessions.find(
              (s: { session_id: string }) => s.session_id === sessionId
            );
    
            if (newSession) {
              setCurrentSession(newSession);
              setProjectName(newSession.session_id);
            }

            setRecordingPhase("recording");
            setDurationSeconds(0);
            setActionsCaptured(0);
            setSelectedStep(1);
            jumpTo("overview");
            showToast("Recording started");
          }
    
          if (result.text?.[0] === "R") {
            window.open(url, "_blank");
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
        setSelectedStep(4);
        jumpTo("trace");
        showToast("Recording completed");
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

    showToast("Robot run queued from workflow memory");
  };
  const visibleEventState = (event: (typeof traceEvents)[number]) => {
    if (selectedStep === event.step) return "Selected";
    if (isRecording && event.step > Math.max(1, Math.min(actionsCaptured, 6))) return "Pending";
    if (isCompleted && event.step <= 6) return "Done";
    return event.state;
  };
    const visibleEventClass = (event: (typeof traceEvents)[number]) => {
    if (selectedStep === event.step) return "";
    if (visibleEventState(event) === "Done") return "done";
    if (visibleEventState(event) === "Pending") return "pending";
    return event.stateClass;
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
          <ProjectDelete/>
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
                              <h3>Expense approval can be reproduced from a clean browser state.</h3>
                            </div>
                            <span className={memoryConfirmed ? "pill green" : "pill amber"}>
                              {memoryConfirmed ? "Confirmed" : "Needs review"}
                            </span>
                          </div>
                          <ol>
                            <li>
                              <strong>Initial state</strong>
                              <span>Open the target URL with the local helper connected.</span>
                            </li>
                            <li>
                              <strong>Operating path</strong>
                              <span>Create an approval request, fill required fields, and submit.</span>
                            </li>
                            <li>
                              <strong>Expected result</strong>
                              <span>Success confirmation appears and the result state is captured.</span>
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
                              onClick={() => (generatedArtifacts.runbook ? openPanel("runbook") : generateArtifact("runbook"))}
                            >
                              {generatedArtifacts.runbook ? "Open output" : "Generate Runbook"} <BookOpen {...icon18} aria-hidden="true" />
                            </button>
                            <button
                              className={loadingAction === "test" ? "btn light loading" : "btn light"}
                              disabled={loadingAction !== null}
                              onClick={() => generateArtifact("test")}
                            >
                              Generate Test <FileCode {...icon18} aria-hidden="true" />
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
                  <p>Use this detail view only when you need to inspect the captured actions behind the memory summary.</p>
                  <div className="timeline-layout">
                    <div className="table">
                      <div className="table-head">
                        <span>Step</span>
                        <span>Action</span>
                        <span>State</span>
                        <span>Time</span>
                      </div>
                      {traceEvents.map((event) => (
                        <button
                          className={selectedStep === event.step ? "table-row selected" : "table-row"}
                          key={event.step}
                          onClick={() => setSelectedStep(event.step)}
                        >
                          <span>{event.step}</span>
                          <strong>{event.action}</strong>
                          <em className={visibleEventClass(event)}>{visibleEventState(event)}</em>
                          <span>{event.time}</span>
                        </button>
                      ))}
                    </div>
                    <div className="flow-map">
                      <span>Stage map</span>
                      <em className={selectedStep === 1 ? "active" : ""}>Nav</em>
                      <em className={selectedStep === 3 ? "active" : ""}>Input</em>
                      <em className={selectedStep === 4 ? "active" : ""}>Submit</em>
                      <em className={selectedStep >= 5 ? "active" : ""}>Verify</em>
                    </div>
                  </div>
                  <div className="trace-next-step">
                    <div>
                      <span>NEXT STEP</span>
                      <h3>{memoryConfirmed ? "Generate outputs from workflow memory" : "Confirm the memory summary first"}</h3>
                      <p>
                        {memoryConfirmed
                          ? "Create a Runbook that can guide people or feed automation."
                          : "Return to the guided flow and save the structured workflow before generating outputs."}
                      </p>
                    </div>
                    <button
                      className={loadingAction === "runbook" ? "btn dark loading" : "btn dark"}
                      disabled={loadingAction !== null}
                      onClick={() =>
                        memoryConfirmed
                          ? generatedArtifacts.runbook
                            ? openPanel("runbook")
                            : generateArtifact("runbook")
                          : confirmMemory()
                      }
                    >
                      {loadingAction === "runbook"
                        ? "Generating"
                        : generatedArtifacts.runbook
                          ? "Open Runbook"
                          : memoryConfirmed
                            ? "Generate Runbook"
                            : "Confirm memory"}{" "}
                      <BookOpen {...icon18} aria-hidden="true" />
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
                      <h2>Outputs from workflow memory</h2>
                      <p>Generated from workflow memory, with initial state and expected stage results preserved.</p>
                    </div>
                    <button className="btn light" disabled={!memoryConfirmed} onClick={copyRunbook}>
                      Copy runbook <Copy {...icon18} aria-hidden="true" />
                    </button>
                  </div>
                  <div className="code-panel">
                    <div className="code-tabs">
                      <span>workflow_memory.md</span>
                      <span>runbook.md</span>
                      <button aria-label="Copy" className={copied ? "copied" : ""} onClick={copyRunbook}>
                        <Copy {...icon18} aria-hidden="true" />
                      </button>
                    </div>
                    <pre>{runbookText}</pre>
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
                      <span>{isCompleted ? `${actionsCaptured} actions with stage results` : "Waiting for structured memory"}</span>
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
              <div className="inspector-content" key={`${selectedRecordingId}-${selectedStep}`}>
                <div className="inspector-title">
                  <h2>{selectedEvent.action}</h2>
                  <span className="pill">Selected</span>
                </div>
                <p>Event {selectedEvent.step} from the selected {selectedRecording.title} recording.</p>

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
                    <dd>sess_mr0re8sa_8u0xr4</dd>
                  </dl>
                </div>
              </div>

              <button className="btn dark block" disabled={isRecording} onClick={beginRecording}>
                Confirm locally on the Mac <Play {...icon18} aria-hidden="true" />
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
