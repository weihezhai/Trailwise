import express, { type Request, type Response } from "express";
import { join } from "node:path";
import type { SessionSummary } from "@trailwise/shared";
import { isAllowedRecordingUrl } from "./allowlist.js";
import type { BackendConfig } from "./config.js";
import { generatePlaywrightArtifact, generateRunbookArtifact } from "./generation.js";
import { postSlackMessage, slackText, verifySlackSignature } from "./slack.js";
import { createStore, type JsonStore } from "./store.js";

export function createServer(config: BackendConfig, store: JsonStore = createStore(config.dataDir)) {
  const app = express();

  app.get("/health", (_request, response) => {
    response.json({ ok: true });
  });

  app.post("/slack/commands", express.raw({ type: "application/x-www-form-urlencoded" }), async (request, response) => {
    if (!verifySlackRequest(request, config)) {
      response.status(401).send("invalid Slack signature");
      return;
    }

    const form = new URLSearchParams(request.body.toString("utf8"));
    const teamId = form.get("team_id") || "T_LOCAL";
    const channelId = form.get("channel_id") || "C_LOCAL";
    const userId = form.get("user_id") || "U_LOCAL";
    const text = (form.get("text") || "").trim();

    response.json(await handleSlashCommand({ text, teamId, channelId, userId, config, store }));
  });

  app.post("/slack/actions", express.raw({ type: "application/x-www-form-urlencoded" }), async (request, response) => {
    if (!verifySlackRequest(request, config)) {
      response.status(401).send("invalid Slack signature");
      return;
    }

    const form = new URLSearchParams(request.body.toString("utf8"));
    const payload = JSON.parse(form.get("payload") || "{}") as {
      team?: { id?: string };
      user?: { id?: string };
      channel?: { id?: string };
      actions?: Array<{ action_id?: string; value?: string }>;
    };
    const action = payload.actions?.[0];

    if (action?.action_id === "generate_playwright_test") {
      const session = action.value ? store.getSession(action.value) : store.findLatestCompletedForSlackUser(payload.team?.id || "", payload.user?.id || "");
      if (!session) {
        response.json(slackText("No completed recording is available for generation."));
        return;
      }

      store.updateSession(session.session_id, { generation_requested_at: new Date().toISOString() });
      void generatePlaywrightArtifact(session, config)
        .then(async (result) => {
          store.updateSession(session.session_id, { generated_artifact_path: result.artifactPath });
          await postSlackMessage({
            token: config.slackBotToken,
            channel: payload.channel?.id || session.slack_channel_id,
            text: `Generated Playwright test for ${session.session_id}: ${result.artifactPath}`
          });
        })
        .catch(async (error) => {
          store.updateSession(session.session_id, { error: String(error) });
          await postSlackMessage({
            token: config.slackBotToken,
            channel: payload.channel?.id || session.slack_channel_id,
            text: `Playwright generation failed for ${session.session_id}: ${String(error)}`
          });
        });

      response.json(slackText("Playwright generation started. I will post the result when it is ready."));
      return;
    }

    if (action?.action_id === "generate_runbook") {
      const session = action.value ? store.getSession(action.value) : store.findLatestCompletedForSlackUser(payload.team?.id || "", payload.user?.id || "");
      if (!session) {
        response.json(slackText("No completed recording is available for runbook generation."));
        return;
      }

      store.updateSession(session.session_id, { generation_requested_at: new Date().toISOString() });
      void generateRunbookArtifact(session, config)
        .then(async (result) => {
          store.updateSession(session.session_id, { generated_runbook_path: result.artifactPath });
          await postSlackMessage({
            token: config.slackBotToken,
            channel: payload.channel?.id || session.slack_channel_id,
            text: `Generated runbook for ${session.session_id}: ${result.artifactPath}`
          });
        })
        .catch(async (error) => {
          store.updateSession(session.session_id, { error: String(error) });
          await postSlackMessage({
            token: config.slackBotToken,
            channel: payload.channel?.id || session.slack_channel_id,
            text: `Runbook generation failed for ${session.session_id}: ${String(error)}`
          });
        });

      response.json(slackText("Runbook generation started. I will post the result when it is ready."));
      return;
    }

    if (action?.action_id === "delete_recording" && action.value) {
      store.updateSession(action.value, { status: "deleted" });
      response.json(slackText(`Recording ${action.value} marked for deletion.`));
      return;
    }

    response.json(slackText("Unsupported action."));
  });

  app.use("/helper", express.json(), (request, response, next) => {
    if (request.path === "/pair") {
      next();
      return;
    }

    if (request.header("x-helper-secret") !== config.helperPairingSecret) {
      response.status(401).json({ error: "invalid helper secret" });
      return;
    }

    next();
  });

  app.post("/helper/pair", express.json(), (request, response) => {
    if (request.header("x-helper-secret") !== config.helperPairingSecret) {
      response.status(401).json({ error: "invalid helper secret" });
      return;
    }

    const deviceId = String(request.body?.device_id || `dev_${Math.random().toString(36).slice(2, 10)}`);
    const name = String(request.body?.name || "Local Mac");
    response.json({ device: store.pairDevice(deviceId, name) });
  });

  app.get("/helper/sessions/pending", (request, response) => {
    const deviceId = String(request.query.device_id || "");
    response.json({ sessions: store.listPendingForDevice(deviceId) });
  });

  app.get("/helper/sessions/:session_id", (request, response) => {
    response.json({ session: store.getSession(request.params.session_id) });
  });

  app.post("/helper/sessions/:session_id/confirm", (request, response) => {
    response.json({ session: store.updateSession(request.params.session_id, { status: "recording", started_at: new Date().toISOString() }) });
  });

  app.post("/helper/sessions/:session_id/cancel", (request, response) => {
    response.json({ session: store.updateSession(request.params.session_id, { status: "cancelled" }) });
  });

  app.post("/helper/sessions/:session_id/started", (request, response) => {
    response.json({ session: store.updateSession(request.params.session_id, { status: "recording", started_at: new Date().toISOString() }) });
  });

  app.post("/helper/sessions/:session_id/stopped", (request, response) => {
    response.json({ session: store.updateSession(request.params.session_id, { status: "completed", stopped_at: new Date().toISOString() }) });
  });

  app.post("/helper/sessions/:session_id/summary", async (request, response) => {
    const summary = request.body as SessionSummary;
    const session = store.updateSession(request.params.session_id, {
      status: "completed",
      stopped_at: new Date().toISOString(),
      summary
    });

    await postCompletionSummary(config, session.slack_channel_id, summary);
    response.json({ session });
  });

  app.post("/helper/sessions/:session_id/delete", (request, response) => {
    response.json({ session: store.updateSession(request.params.session_id, { status: "deleted" }) });
  });

  app.delete("/dev/sessions/:session_id", (request, response) => {
    response.json({ session: store.updateSession(request.params.session_id, { status: "deleted" }) });
  });

  app.post("/sessions/:session_id/generate", express.json(), async (request, response) => {
    const session = store.getSession(request.params.session_id);
    const result = await generatePlaywrightArtifact(session, config);
    store.updateSession(session.session_id, { generated_artifact_path: result.artifactPath });
    response.json(result);
  });

  app.post("/sessions/:session_id/generate-runbook", express.json(), async (request, response) => {
    const session = store.getSession(request.params.session_id);
    const result = await generateRunbookArtifact(session, config);
    store.updateSession(session.session_id, { generated_runbook_path: result.artifactPath });
    response.json(result);
  });

  app.post("/dev/slack-command", express.json(), async (request, response) => {
    const result = await handleSlashCommand({
      text: String(request.body?.text || ""),
      teamId: String(request.body?.team_id || "T_LOCAL"),
      channelId: String(request.body?.channel_id || "C_LOCAL"),
      userId: String(request.body?.user_id || "U_LOCAL"),
      config,
      store
    });
    response.json(result);
  });

  app.get("/dev/sessions", (_request, response) => {
    response.json({ sessions: store.listSessions() });
  });

  return { app, store };
}

async function handleSlashCommand(options: {
  text: string;
  teamId: string;
  channelId: string;
  userId: string;
  config: BackendConfig;
  store: JsonStore;
}) {
  const [command, ...rest] = options.text.split(/\s+/);
  const argument = rest.join(" ");

  if (command === "start") {
    if (!argument || !isAllowedRecordingUrl(argument, options.config.allowedRecordingOrigins)) {
      return slackText(`Target URL is not allowed. Allowed origins: ${options.config.allowedRecordingOrigins.join(", ")}`);
    }

    const paired = options.store.getFirstDevice();
    const session = options.store.createSession({
      slack_team_id: options.teamId,
      slack_channel_id: options.channelId,
      slack_user_id: options.userId,
      target_url: argument,
      device_id: paired?.device_id
    });

    return slackText(`Ready to record Chrome workflow.

Device: ${paired?.name ?? "not connected"}
Chrome extension: Checked by local helper
Screen recording: Not required yet
Target: ${argument}
Session: ${session.session_id}

Confirm locally on the Mac to start recording.`);
  }

  if (command === "stop") {
    const session = options.store.findActiveForSlackUser(options.teamId, options.userId);
    if (!session) return slackText("No active recording session found.");
    options.store.updateSession(session.session_id, { status: "stopping" });
    return slackText(`Stop requested for ${session.session_id}. The Mac helper will finalize the trace.`);
  }

  if (command === "status") {
    const session = options.store.findActiveForSlackUser(options.teamId, options.userId);
    if (!session) return slackText("No active recording session found.");
    return slackText(`Recording status: ${session.status}
Target: ${session.target_url}
Session: ${session.session_id}`);
  }

  if (command === "generate-test") {
    const session = options.store.findLatestCompletedForSlackUser(options.teamId, options.userId);
    if (!session) return slackText("No completed recording is available for generation.");
    const result = await generatePlaywrightArtifact(session, options.config);
    options.store.updateSession(session.session_id, { generated_artifact_path: result.artifactPath });
    return slackText(`Generated Playwright test: ${result.artifactPath}`);
  }

  if (command === "generate-runbook") {
    const session = options.store.findLatestCompletedForSlackUser(options.teamId, options.userId);
    if (!session) return slackText("No completed recording is available for runbook generation.");
    const result = await generateRunbookArtifact(session, options.config);
    options.store.updateSession(session.session_id, { generated_runbook_path: result.artifactPath });
    return slackText(`Generated runbook: ${result.artifactPath}`);
  }

  return slackText(`Usage:
/record-workflow start <target_url>
/record-workflow stop
/record-workflow status
/record-workflow generate-test
/record-workflow generate-runbook`);
}

async function postCompletionSummary(config: BackendConfig, channel: string, summary: SessionSummary): Promise<void> {
  const text = `Workflow recording complete.

Target: ${summary.url_start ?? "unknown"}
Duration: ${Math.round(summary.duration_ms / 1000)}s
Captured actions: ${summary.events_count}
Screenshots: ${summary.screenshots_count}
Sensitive fields redacted: ${summary.redactions_count}

Trace: ${summary.trace_path ?? "local helper storage"}`;

  await postSlackMessage({
    token: config.slackBotToken,
    channel,
    text,
    blocks: completionBlocks(summary, text)
  });
}

function completionBlocks(summary: SessionSummary, text: string): unknown[] {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text
      }
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Generate Playwright test" },
          action_id: "generate_playwright_test",
          value: summary.session_id
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Generate runbook" },
          action_id: "generate_runbook",
          value: summary.session_id
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Delete recording" },
          action_id: "delete_recording",
          style: "danger",
          value: summary.session_id
        }
      ]
    }
  ];
}

function verifySlackRequest(request: Request, config: BackendConfig): boolean {
  return verifySlackSignature({
    signingSecret: config.slackSigningSecret,
    timestamp: request.header("x-slack-request-timestamp"),
    signature: request.header("x-slack-signature"),
    rawBody: request.body
  });
}
