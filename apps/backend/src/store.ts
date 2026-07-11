import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { SessionSummary } from "@trailwise/shared";

export type SessionStatus =
  | "created"
  | "pending_local_confirmation"
  | "recording"
  | "stopping"
  | "completed"
  | "cancelled"
  | "failed"
  | "deleted";

export interface RecordingSession {
  session_id: string;
  slack_team_id: string;
  slack_channel_id: string;
  slack_user_id: string;
  target_url: string;
  device_id?: string;
  recording_transport?: "helper" | "backend";
  status: SessionStatus;
  created_at: string;
  started_at?: string;
  stopped_at?: string;
  generation_requested_at?: string;
  generated_artifact_path?: string;
  generated_runbook_path?: string;
  generated_skill_path?: string;
  summary?: SessionSummary;
  error?: string;
}

export interface DeviceRecord {
  device_id: string;
  name: string;
  paired_at: string;
  last_seen_at: string;
}

export interface StoreShape {
  sessions: RecordingSession[];
  devices: DeviceRecord[];
}

export class JsonStore {
  private data: StoreShape;

  constructor(private readonly filePath: string) {
    mkdirSync(dirname(filePath), { recursive: true });
    this.data = this.read();
  }

  createSession(input: Omit<RecordingSession, "session_id" | "status" | "created_at">): RecordingSession {
    const session: RecordingSession = {
      ...input,
      session_id: `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      status: "pending_local_confirmation",
      created_at: new Date().toISOString()
    };
    this.data.sessions.push(session);
    this.write();
    return session;
  }

  updateSession(sessionId: string, patch: Partial<RecordingSession>): RecordingSession {
    const session = this.getSession(sessionId);
    Object.assign(session, patch);
    this.write();
    return session;
  }

  getSession(sessionId: string): RecordingSession {
    const session = this.data.sessions.find((candidate) => candidate.session_id === sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    return session;
  }

  findActiveForSlackUser(teamId: string, userId: string): RecordingSession | undefined {
    return [...this.data.sessions]
      .reverse()
      .find(
        (session) =>
          session.slack_team_id === teamId &&
          session.slack_user_id === userId &&
          ["pending_local_confirmation", "recording", "stopping"].includes(session.status)
      );
  }

  findLatestCompletedForSlackUser(teamId: string, userId: string): RecordingSession | undefined {
    return [...this.data.sessions]
      .reverse()
      .find((session) => session.slack_team_id === teamId && session.slack_user_id === userId && session.status === "completed");
  }

  findLatestRecordingForUrl(eventUrl: string): RecordingSession | undefined {
    let parsed: URL;
    try {
      parsed = new URL(eventUrl);
    } catch {
      return undefined;
    }

    return [...this.data.sessions].reverse().find((session) => {
      if (session.status !== "recording") return false;
      try {
        return new URL(session.target_url).origin === parsed.origin;
      } catch {
        return false;
      }
    });
  }

  listPendingForDevice(deviceId: string): RecordingSession[] {
    return this.data.sessions.filter((session) => {
      const matchesDevice = !session.device_id || session.device_id === deviceId;
      return matchesDevice && ["pending_local_confirmation", "stopping", "deleted"].includes(session.status);
    });
  }

  pairDevice(deviceId: string, name: string): DeviceRecord {
    const now = new Date().toISOString();
    const existing = this.data.devices.find((device) => device.device_id === deviceId);
    if (existing) {
      existing.name = name;
      existing.last_seen_at = now;
      this.write();
      return existing;
    }

    const device = { device_id: deviceId, name, paired_at: now, last_seen_at: now };
    this.data.devices.push(device);
    this.write();
    return device;
  }

  getFirstDevice(): DeviceRecord | undefined {
    return this.data.devices[0];
  }

  listSessions(): RecordingSession[] {
    return [...this.data.sessions];
  }

  private read(): StoreShape {
    if (!existsSync(this.filePath)) return { sessions: [], devices: [] };
    return JSON.parse(readFileSync(this.filePath, "utf8")) as StoreShape;
  }

  private write(): void {
    writeFileSync(this.filePath, `${JSON.stringify(this.data, null, 2)}\n`);
  }
}

export function createStore(dataDir: string): JsonStore {
  return new JsonStore(join(dataDir, "backend-store.json"));
}
