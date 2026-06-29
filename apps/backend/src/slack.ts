import crypto from "node:crypto";

export function verifySlackSignature(options: {
  signingSecret?: string;
  timestamp?: string | string[];
  signature?: string | string[];
  rawBody: Buffer;
  allowUnsignedInDevelopment?: boolean;
}): boolean {
  const timestamp = Array.isArray(options.timestamp) ? options.timestamp[0] : options.timestamp;
  const signature = Array.isArray(options.signature) ? options.signature[0] : options.signature;

  if (!options.signingSecret) {
    return options.allowUnsignedInDevelopment ?? process.env.NODE_ENV !== "production";
  }

  if (!timestamp || !signature) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > 60 * 5) return false;

  const base = `v0:${timestamp}:${options.rawBody.toString("utf8")}`;
  const digest = `v0=${crypto.createHmac("sha256", options.signingSecret).update(base).digest("hex")}`;

  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function postSlackMessage(options: {
  token?: string;
  channel?: string;
  text: string;
  blocks?: unknown[];
}): Promise<void> {
  if (!options.token || !options.channel) {
    console.log(`[slack:dry-run] ${options.text}`);
    if (options.blocks?.length) {
      console.log(`[slack:dry-run:blocks] ${JSON.stringify(options.blocks, null, 2)}`);
    }
    return;
  }

  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      channel: options.channel,
      text: options.text,
      blocks: options.blocks
    })
  });

  const body = (await response.json()) as { ok?: boolean; error?: string };
  if (!body.ok) {
    throw new Error(`Slack chat.postMessage failed: ${body.error ?? response.statusText}`);
  }
}

export interface SlackAuthTestResult {
  ok: boolean;
  url?: string;
  team?: string;
  user?: string;
  team_id?: string;
  user_id?: string;
  bot_id?: string;
  error?: string;
}

export async function testSlackAuth(token: string): Promise<SlackAuthTestResult> {
  const response = await fetch("https://slack.com/api/auth.test", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: ""
  });
  return (await response.json()) as SlackAuthTestResult;
}

export function slackText(text: string): { response_type: "ephemeral"; text: string } {
  return { response_type: "ephemeral", text };
}

export function maskSlackToken(token: string): string {
  if (token.length <= 12) return "<redacted>";
  return `${token.slice(0, 8)}...${token.slice(-4)}`;
}

export function isLikelyBotToken(token: string): boolean {
  return token.startsWith("xoxb-");
}
