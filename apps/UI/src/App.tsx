import {
  startRecording,
  stopRecording,
  statusRecording,
  generateTest,
  deleteSession,
  getRecordingLog,
  waitForRecordingCompleted,
  generateRunbook,
  getGeneratedRunbook,
  generateSkill,
  replaySkillSession,
} from "./api/trailwise";

import MissionRail from "./component/MissionRail";
import TopBar from "./component/TopBar";
import WorkspaceSidebar from "./component/WorkspaceSidebar";
import { AnimatedTabs, type AnimatedTabItem } from "./component/ui/AnimatedTabs";
import { GridBackground } from "./component/ui/GridBackground";

import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Bot,
  LayoutDashboard,
  Route,
} from "lucide-react";
import ProjectDelete from "./component/ProjectDelete";
import WorkflowOverviewPanel from "./component/WorkflowOverviewPanel";
import TraceReviewPanel from "./component/TraceReviewPanel";
import RunbookPanel from "./component/RunbookPanel";
import AutomationPanel from "./component/AutomationPanel";
import WorkflowHeader from "./component/WorkflowHeader";
import WorkflowInspector from "./component/WorkflowInspector";
import WorkflowLayout from "./component/WorkflowLayout";
import type { LoadingAction, Panel, ProjectSession, Toast, TraceEventItem, WorkflowStage, ThemeMode, RecordingPhase } from "./component/types";
import { formatDuration, transformTraceEvents } from "./component/workflowHelpers";

const icon18 = { size: 18, strokeWidth: 1.75 };

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
  const [currentSession, setCurrentSession] = useState<ProjectSession | null>(null);
  const [sessions, setSessions] = useState<ProjectSession[]>([]);

  const [activePanel, setActivePanel] = useState<Panel>("overview");
  const [selectedStep, setSelectedStep] = useState(4);
  const [recordingPhase, setRecordingPhase] = useState<RecordingPhase>("ready");
  const [durationSeconds, setDurationSeconds] = useState(recordingSeed[0].duration);
  const [actionsCaptured, setActionsCaptured] = useState(recordingSeed[0].actions);
  const [loadingAction, setLoadingAction] = useState<LoadingAction>(null);
  const [generatedArtifacts, setGeneratedArtifacts] = useState({ test: false, runbook: false });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [copied, setCopied] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [targetUrl, setTargetUrl] = useState("http://localhost:5173/expense-flow.html");
  const summaryRef = useRef<HTMLElement>(null);
  const timelineRef = useRef<HTMLElement>(null);
  const runbookRef = useRef<HTMLElement>(null);
  const automationRef = useRef<HTMLElement>(null);
  const [memoryConfirmed, setMemoryConfirmed] = useState(false);
  const [runbookText, setRunbookText] = useState("No runbook generated yet");

  const [traceEvents, setTraceEvents] = useState<TraceEventItem[]>([]);
  const [traceLoading, setTraceLoading] = useState(false);
  const traceRequestRef = useRef(0);


  
  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    try {
      localStorage.setItem("trailwise-theme", themeMode);
    } catch {
      // Ignore storage failures in restricted desktop shells.
    }
  }, [themeMode]);

  const selectedEvent =
    traceEvents.find((event) => event.step === selectedStep) ??
    traceEvents[0] ??
    null;
  const sessionStatus = currentSession?.status?.toLowerCase() ?? "";
  const isSessionRecording = sessionStatus.includes("recording");
  const isSessionCompleted =/completed|finished|recorded|stopped/.test(sessionStatus);
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
    : sessionStatus.includes("stopped") ||
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
  
  const openProjectSession = async (session: {
    session_id: string;
    status: string;
  }) => {
    // Clear the previous project before loading this one.
    setTraceEvents([]);
    setSelectedStep(0);
    setMemoryConfirmed(false);

    try {
      const result = await statusRecording(session.session_id);
      const statusText = result?.text ?? "";

      const matched =
        statusText.match(/Recording status:\s*(\S+)/i) ||
        statusText.match(
          /(pending|recording|completed|ready|stopped|failed|cancelled|finished|generated|recorded)/i,
        );

      const freshStatus = (matched?.[1] ?? session.status).trim();
      const normalizedStatus = freshStatus.toLowerCase();

      const isGenerated = /generated|saved/.test(normalizedStatus);
      const isReview = /finished|recorded|completed|stopped/.test(
        normalizedStatus,
      );
      const isRecordPhase = /pending|recording|ready/.test(normalizedStatus);

      if (isGenerated) {
        setRecordingPhase("completed");
        setMemoryConfirmed(true);
      } else if (isReview) {
        setRecordingPhase("completed");
        setMemoryConfirmed(false);
      } else if (isRecordPhase) {
        setRecordingPhase(
          normalizedStatus.includes("recording")
            ? "recording"
            : "ready",
        );
        setMemoryConfirmed(false);
      }

      const selectedSession = {
        ...session,
        status: freshStatus,
      };

      // Set the current project before loading its details.
      setCurrentSession(selectedSession);
      setProjectName(session.session_id);
      setSidebarOpen(false);

      if (isReview || isGenerated) {
        await loadRecordingDetails(session.session_id);
        setActivePanel("trace");
      } else {
        // An uncompleted project should never show old trace data.
        setTraceEvents([]);
        setSelectedStep(0);
        setActivePanel("overview");
      }

      showToast(`Loaded ${session.session_id} (${freshStatus})`);
      await loadSessions();
    } catch (error) {
      console.error("Failed to open project:", error);

      setCurrentSession(session);
      setTraceEvents([]);
      setSelectedStep(0);
      setMemoryConfirmed(false);
      setActivePanel("overview");

      showToast(
        `Loaded ${session.session_id}, but its memory could not be loaded`,
        "error",
      );
    }
  };
  

const loadRecordingDetails = async (
  sessionId: string,
): Promise<TraceEventItem[]> => {
  const requestId = ++traceRequestRef.current;

  setTraceEvents([]);
  setSelectedStep(0);
  setTraceLoading(true);

  try {
    const log = await getRecordingLog(sessionId);

    if (requestId !== traceRequestRef.current) {
      return [];
    }

    const events = transformTraceEvents(log.events ?? []);

    setTraceEvents(events);

    if (events.length > 0) {
      setSelectedStep(events[0].step);
    }

    return events;
  } catch (error) {
    if (requestId === traceRequestRef.current) {
      setTraceEvents([]);
      setSelectedStep(0);
    }

    throw error;
  } finally {
    if (requestId === traceRequestRef.current) {
      setTraceLoading(false);
    }
  }
};

  const handleGenerateRunbook = async () => {
    const sessionId = currentSession?.session_id;

    if (!sessionId) {
      showToast(
        "No recording session is selected",
        "error",
      );
      return;
    }

    try {
      setLoadingAction("runbook");

      console.log(
        "Generating runbook for session:",
        sessionId,
      );

      await generateRunbook(sessionId);

      const runbook = await getGeneratedRunbook(
        sessionId,
      );

      setRunbookText(runbook.content ?? "");

      setGeneratedArtifacts((current) => ({
        ...current,
        runbook: true,
      }));

      setActivePanel("runbook");

      showToast("Runbook generated successfully");
    } catch (error) {
      console.error(
        "Runbook generation failed:",
        error,
      );

      showToast(
        error instanceof Error
          ? error.message
          : "Runbook generation failed",
        "error",
      );
    } finally {
      setLoadingAction(null);
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
    const sessionId = currentSession?.session_id;

    if (!sessionId) {
      showToast("No project is selected", "error");
      return;
    }

    if (!isCompleted) {
      showToast(
        "Complete the recording before confirming memory",
        "error",
      );
      return;
    }

    try {
      setLoadingAction("test");

      const events = await loadRecordingDetails(sessionId);

      if (events.length === 0) {
        throw new Error(
          "Cannot confirm memory because no browser actions were recorded",
        );
      }

      let artifactPath =
        currentSession.generated_artifact_path;

      if (!artifactPath) {
        const testResult = await generateTest(sessionId);
        artifactPath = testResult.artifactPath;
      }

      setCurrentSession((current) =>
        current?.session_id === sessionId
          ? {
              ...current,
              generated_artifact_path: artifactPath,
            }
          : current,
      );

      setMemoryConfirmed(true);
      setActionsCaptured(events.length);
      setDurationSeconds(Math.max(...events.map((e) => parseInt(e.time.split(":")[0]) * 60 + parseInt(e.time.split(":")[1]))));
      setSelectedStep(1);
      setGeneratedArtifacts((current) => ({
        ...current,
        test: true,
      }));

      showToast("Workflow memory saved");

      try {
        setLoadingAction("runbook");

        const runbookResult =
          await generateRunbook(sessionId);

        const generatedRunbook =
          await getGeneratedRunbook(sessionId);

        setRunbookText(
          generatedRunbook.content ??
            "Generated runbook is empty.",
        );

        setCurrentSession((current) =>
          current?.session_id === sessionId
            ? {
                ...current,
                generated_runbook_path:
                  runbookResult.artifactPath,
              }
            : current,
        );

        setGeneratedArtifacts((current) => ({
          ...current,
          runbook: true,
        }));

        setActivePanel("runbook");
        showToast("Runbook generated successfully");
      } catch (runbookError) {
        console.error(
          "Runbook generation failed:",
          runbookError,
        );

        setActivePanel("trace");

        showToast(
          runbookError instanceof Error
            ? `Memory saved, but runbook failed: ${runbookError.message}`
            : "Memory saved, but runbook generation failed",
          "error",
        );
      }

      await loadSessions();
    } catch (error) {
      console.error("Memory confirmation failed:", error);

      setMemoryConfirmed(false);

      showToast(
        error instanceof Error
          ? error.message
          : "Memory confirmation failed",
        "error",
      );
    } finally {
      setLoadingAction(null);
    }
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
    const res = await fetch(
      "http://localhost:3000/dev/sessions",
    );

    if (!res.ok) {
      throw new Error(`Failed to load sessions: ${res.status}`);
    }

    const data = await res.json();

    setSessions(
      data.sessions.filter(
        (session: ProjectSession) =>
          session.status !== "deleted",
      ),
    );
  }


   const beginRecording = async () => {
    if (isRecording) return;
    try {
          const result = await startRecording(targetUrl);
    
          console.log(result);
    
          setMessage(result.text ?? JSON.stringify(result));
    
          await loadSessions();
    
          const match = result.text?.match(/Session:\s*(\S+)/);
          const sessionId = result.session_id ?? match?.[1];
    
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
            window.open(targetUrl, "_blank");
          }
        } catch (err) {

          console.error(err);
          setMessage("Start failed");
        }
  };

const handleStop = async () => {
  if (!currentSession) return;

  const sessionId = currentSession.session_id;

  try {
    setMessage("Stopping recording...");

    const stopResult = await stopRecording(sessionId);
    const completedResult = await waitForRecordingCompleted(sessionId);

    console.log({
      stopResult,
      completedResult,
    });

    const res = await fetch("http://localhost:3000/dev/sessions");

    if (!res.ok) {
      throw new Error(`Failed to load sessions: ${res.status}`);
    }

    const data = await res.json();

    const updatedSession = data.sessions.find(
      (session: { session_id: string }) =>
        session.session_id === sessionId,
    );

    setCurrentSession(
      updatedSession ?? {
        ...currentSession,
        status: "completed",
      },
    );

    setMessage(completedResult.text ?? "Recording completed");
    setRecordingPhase("completed");
    setSelectedStep(4);

    jumpTo("overview");
    showToast("Recording completed");

    await loadSessions();
  } catch (error) {
    console.error("Stop failed:", error);

    const message =
      error instanceof Error ? error.message : "Unknown stop error";

    setMessage(`Stop failed: ${message}`);
    showToast(message, "error");
  }
};

  const handleDelete= async() => {
    if (!currentSession) return;
    try {
      const result = await deleteSession(currentSession.session_id);
      console.log(result);
      setCurrentSession(null);
      setRecordingPhase("ready");      // <-- important
      setMemoryConfirmed(false);       // <-- important
      setSelectedStep(1);              // optional
      setActivePanel("overview"); 
    
    }catch (err) {
        console.error(err);
        setMessage("Stop failed");      
    }
  }

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
  const ConfirmRunBook = async () => {
    jumpTo("automation");
    return;
  }
const queueAutomation = async () => {
  const sessionId = currentSession?.session_id;

  if (!sessionId) {
    showToast("No project is selected", "error");
    return;
  }

  if (!isCompleted || !memoryConfirmed) {
    showToast(
      "Confirm workflow memory before starting the robot run",
      "error",
    );
    return;
  }

  try {
    if (!currentSession.generated_skill_path) {
      const skill = await generateSkill(sessionId);

      setCurrentSession((current) =>
        current?.session_id === sessionId
          ? {
              ...current,
              generated_skill_path: skill.artifactPath,
            }
          : current,
      );
    }

    showToast("Robot run started");

    const result = await replaySkillSession(sessionId, {
      headless: false,
    });

    console.log("Replay result:", result);

    showToast(
      `Robot completed ${result.result?.events_replayed ?? 0} actions`,
    );
  } catch (error) {
    showToast(
      error instanceof Error
        ? error.message
        : "Robot run failed",
      "error",
    );
  }
};
const visibleEventState = (event: TraceEventItem) => {
  if (selectedStep === event.step) {
    return "Selected";
  }

  if (
    isRecording &&
    event.step > Math.max(1, Math.min(actionsCaptured, traceEvents.length))
  ) {
    return "Pending";
  }

  if (isCompleted) {
    return "Done";
  }

  return event.state;
};

const visibleEventClass = (event: TraceEventItem) => {
  if (selectedStep === event.step) {
    return "";
  }

  const state = visibleEventState(event);

  if (state === "Done") {
    return "done";
  }

  if (state === "Pending") {
    return "pending";
  }

  return event.stateClass;
};
  return (
    <WorkflowLayout
      sidebarOpen={sidebarOpen}
      sidebar={
        <>
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
        </>
      }
      header={
        <>
          <GridBackground className="workspace-grid-background" />
          <WorkflowHeader
            title={`Record ${currentSession?.session_id || "New"} workflow`}
            statusLabel={statusLabel}
            isRecording={isRecording}
            isCompleted={isCompleted}
            memoryConfirmed={memoryConfirmed}
            currentSessionStatus={currentSession?.status ?? undefined}
          />
          <ProjectDelete session={currentSession} onDelete={handleDelete} />
          <AnimatedTabs activeId={activePanel} items={mainTabs} onChange={(panel) => openPanel(panel as Panel)} />
        </>
      }
      content={
        <div className={`content-grid panel-${activePanel}`}>
          <div className="primary-column">
            {activePanel === "overview" && (
              <WorkflowOverviewPanel
                workflowStage={workflowStage}
                isRecording={isRecording}
                isCompleted={isCompleted}
                memoryConfirmed={memoryConfirmed}
                statusLabel={statusLabel}
                durationSeconds={durationSeconds}
                actionsCaptured={actionsCaptured}
                currentSession={currentSession}
                targetUrl={targetUrl}
                onTargetUrlChange={setTargetUrl}
                stageCopy={stageCopy}
                workflowSteps={workflowSteps}
                workflowStageIndex={workflowStageIndex}
                loadingAction={loadingAction}
                generatedArtifacts={generatedArtifacts}
                panelRef={summaryRef}
                onJumpTo={jumpTo}
                onStartRecording={beginRecording}
                onCheckStatus={checkStatus}
                onStopRecording={handleStop}
                onConfirmMemory={confirmMemory}
                onOpenTrace={() => openPanel("trace")}
                onQueueAutomation={queueAutomation}
                onGenerateRunbook={handleGenerateRunbook}
                onGenerateArtifact={generateArtifact}
                onOpenPanel={openPanel}
              />
            )}

            {activePanel === "trace" && (
              <TraceReviewPanel
                workflowStage={workflowStage}
                traceEvents={traceEvents}
                selectedStep={selectedStep}
                panelRef={timelineRef}
                setSelectedStep={setSelectedStep}
                onConfirmMemory={confirmMemory}
                visibleEventClass={visibleEventClass}
                visibleEventState={visibleEventState}
              />
            )}

            {activePanel === "runbook" && (
              <RunbookPanel
                workflowStage={workflowStage}
                memoryConfirmed={memoryConfirmed}
                runbookText={runbookText}
                copied={copied}
                panelRef={runbookRef}
                onCopyRunbook={copyRunbook}
                onConfirmRunBook={ConfirmRunBook}
              />
            )}

            {activePanel === "automation" && (
              <AutomationPanel
                isCompleted={isCompleted}
                actionsCaptured={actionsCaptured}
                panelRef={automationRef}
                onQueueAutomation={queueAutomation}
                onCheckStatus={checkStatus}
              />
            )}
          </div>

          {activePanel === "trace" && (
            <WorkflowInspector
              selectedEvent={selectedEvent}
              currentSessionId={currentSession?.session_id}
              targetUrl={targetUrl}
              traceLoading={traceLoading}
            />
          )}
        </div>
      }
    >
      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div className={toast.tone === "error" ? "toast error" : "toast"} key={toast.id}>
            {toast.message}
          </div>
        ))}
      </div>
    </WorkflowLayout>
  );
}
