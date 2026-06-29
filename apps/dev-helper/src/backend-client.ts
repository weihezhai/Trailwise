import type { SessionSummary } from "@trailwise/shared";
import type { DevHelperConfig } from "./config.js";

export interface BackendSession {
  session_id: string;
  target_url: string;
  status: string;
}

export class BackendClient {
  constructor(private readonly config: DevHelperConfig) {}

  pair(): Promise<unknown> {
    return this.post("/helper/pair", {
      device_id: this.config.deviceId,
      name: this.config.deviceName
    });
  }

  async pendingSessions(): Promise<BackendSession[]> {
    const response = (await this.get(`/helper/sessions/pending?device_id=${encodeURIComponent(this.config.deviceId)}`)) as {
      sessions: BackendSession[];
    };
    return response.sessions;
  }

  async session(sessionId: string): Promise<BackendSession> {
    const response = (await this.get(`/helper/sessions/${sessionId}`)) as { session: BackendSession };
    return response.session;
  }

  confirm(sessionId: string): Promise<unknown> {
    return this.post(`/helper/sessions/${sessionId}/confirm`, {});
  }

  cancel(sessionId: string): Promise<unknown> {
    return this.post(`/helper/sessions/${sessionId}/cancel`, {});
  }

  summary(sessionId: string, summary: SessionSummary): Promise<unknown> {
    return this.post(`/helper/sessions/${sessionId}/summary`, summary);
  }

  private async get(path: string): Promise<unknown> {
    const response = await fetch(new URL(path, this.config.backendBaseUrl), {
      headers: { "x-helper-secret": this.config.helperSecret }
    });
    return this.parse(response);
  }

  private async post(path: string, body: unknown): Promise<unknown> {
    const response = await fetch(new URL(path, this.config.backendBaseUrl), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-helper-secret": this.config.helperSecret
      },
      body: JSON.stringify(body)
    });
    return this.parse(response);
  }

  private async parse(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!response.ok) throw new Error(`Backend request failed ${response.status}: ${text}`);
    return text ? JSON.parse(text) : {};
  }
}
