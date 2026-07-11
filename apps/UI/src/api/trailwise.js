const API = "http://localhost:3000";

async function fetchJson(path, options) {
  const res = await fetch(`${API}${path}`, options);
  const raw = await res.text();

  let payload = {};

  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = {
      message: raw,
    };
  }

  if (!res.ok) {
    console.error("Trailwise API error:", {
      path,
      status: res.status,
      payload,
    });

    throw new Error(
      payload.message ||
        payload.error ||
        `Trailwise API request failed: ${res.status}`,
    );
  }

  return payload;
}

function extractSessionId(text) {
  return text?.match(/Session:\s*(\S+)/i)?.[1] ?? null;
}

function extractStatus(text) {
  return text?.match(/Recording status:\s*(\S+)/i)?.[1]?.toLowerCase() ?? null;
}

async function slackCommand(text) {
  const payload = await fetchJson("/dev/slack-command", {
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
    ...payload,
    session_id: payload.session_id ?? extractSessionId(payload.text),
  };
}

export function startRecording(url, sessionId) {
  if (sessionId) {
    return slackCommand(`start ${sessionId} ${url}`);
  }

  return slackCommand(`start ${url}`);
}

export function stopRecording(sessionId) {
  return slackCommand(sessionId ? `stop ${sessionId}` : "stop");
}

export function statusRecording(sessionId) {
  return slackCommand(sessionId ? `status ${sessionId}` : "status");
}


export async function waitForRecordingCompleted(
  sessionId,
  { intervalMs = 1000, timeoutMs = 30000 } = {},
) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const result = await statusRecording(sessionId);
    const status = extractStatus(result.text);

    console.log("Recording status:", status);

    if (status === "completed") {
      return result;
    }

    if (["cancelled", "deleted", "failed"].includes(status)) {
      throw new Error(`Recording ended with status: ${status}`);
    }

    await new Promise((resolve) => {
      window.setTimeout(resolve, intervalMs);
    });
  }

  throw new Error("Timed out waiting for the recording to complete.");
}

export function getRecordingLog(sessionId) {
  return fetchJson(
    `/sessions/${encodeURIComponent(sessionId)}/log`,
    {
      method: "GET",
    },
  );
}

export function generateTest(id) {
  return fetchJson(`/sessions/${encodeURIComponent(id)}/generate`, {
    method: "POST",
  });
}

export function generateRunbook(id) {
  return fetchJson(
    `/sessions/${encodeURIComponent(id)}/generate-runbook`,
    {
      method: "POST",
    },
  );
}

export function getGeneratedRunbook(id) {
  return fetchJson(
    `/sessions/${encodeURIComponent(id)}/runbook`,
    {
      method: "GET",
    },
  );
}

export function generateSkill(id) {
  return fetchJson(`/sessions/${encodeURIComponent(id)}/generate-skill`, {
    method: "POST",
  });
}

export function deleteSession(id) {
  return fetchJson(`/dev/sessions/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}


export function replaySkillSession(
  id, options,
) {
  return fetchJson(
    `/sessions/${encodeURIComponent(id)}/replay`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(options),
    },
  );
}