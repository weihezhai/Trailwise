const API = "http://localhost:3000";

async function slackCommand(text) {
  const res = await fetch(`${API}/dev/slack-command`, {
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

  return res.json();
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

export async function generateTest(id) {
  const res = await fetch(`${API}/sessions/${id}/generate`, {
    method: "POST",
  });
  console.log (res.json());
  return res;
}

export async function generateRunbook(id) {
  const res = await fetch(`${API}/sessions/${id}/generate-runbook`, {
    method: "POST",
  });

  return res.json();
}

export async function deleteSession(id) {
  const res = await fetch(`${API}/dev/sessions/${id}`, {
    method: "DELETE",
  });

  return res.json();
}