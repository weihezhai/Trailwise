const API = import.meta.env.VITE_TRAILWISE_API_URL || "http://localhost:3100";

async function fetchJson(path, options) {
  const res = await fetch(`${API}${path}`, options);
  const payload = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(payload.message || payload.error || `Trailwise API request failed: ${res.status}`);
  }

  return payload;
}

function extractSessionId(text) {
  return text?.match(/Session:\s*(\S+)/i)?.[1] ?? null;
}

async function slackCommand(text) {
  const res = await fetchJson("/dev/slack-command", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      team_id: "T_LOCAL",
      channel_id: "C_LOCAL",
      user_id: "U_LOCAL",
    }),
  });

  return {
    ...res,
    session_id: extractSessionId(res.text),
  };
}

export function startRecording(url, sessionId) {
  if (sessionId) {
    // start sess_xxx http://localhost:5173
    return slackCommand(`start ${sessionId} ${url}`);
  }

  // start http://localhost:5173
  return slackCommand(`start ${url}`);
}

export function stopRecording(sessionId) {
  if (sessionId) {
    return slackCommand(`stop ${sessionId}`);
  }

  return slackCommand("stop");
}


export function statusRecording(sessionId) {
  if (sessionId) {
    return slackCommand(`status ${sessionId}`);
  }

  return slackCommand("status");
}

export async function listSessions() {
  const data = await fetchJson("/dev/sessions");
  return data.sessions ?? [];
}

export async function getSessionLog(id) {
  return fetchJson(`/sessions/${encodeURIComponent(id)}/log`);
}

export async function generateTest(id) {
  return fetchJson(`/sessions/${encodeURIComponent(id)}/generate`, {
    method: "POST",
  });
}

export async function generateRunbook(id) {
  return fetchJson(`/sessions/${encodeURIComponent(id)}/generate-runbook`, {
    method: "POST",
  });
}

export async function generateSkill(id) {
  return fetchJson(`/sessions/${encodeURIComponent(id)}/generate-skill`, {
    method: "POST",
  });
}

export async function deleteSession(id) {
  return fetchJson(`/dev/sessions/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
