const HOST_NAME = "com.trailwise.workflow_recorder";
const BACKEND_RECORD_EVENTS_URLS = [
  "http://localhost:3000/record/events",
  "http://localhost:3100/record/events"
];
let nativePort = null;
let connecting = false;
let nativeUnavailable = false;

function connectNative() {
  if (nativePort || connecting) return nativePort;
  connecting = true;
  try {
    nativePort = chrome.runtime.connectNative(HOST_NAME);
    nativePort.onDisconnect.addListener(() => {
      const message = chrome.runtime.lastError?.message;
      if (message) console.warn(`Trailwise native host disconnected: ${message}`);
      nativePort = null;
      nativeUnavailable = true;
      connecting = false;
    });
    nativePort.onMessage.addListener((message) => {
      if (message?.kind === "record_event_ignored") {
        console.debug("Trailwise event ignored", message.reason);
      }
    });
    nativePort.postMessage({ kind: "health_check" });
  } catch (error) {
    console.warn("Trailwise native host unavailable", error);
    nativePort = null;
    nativeUnavailable = true;
  } finally {
    connecting = false;
  }
  return nativePort;
}

function postNative(message) {
  if (nativeUnavailable) return false;
  const port = connectNative();
  if (!port) return false;
  try {
    port.postMessage(message);
    return true;
  } catch (error) {
    console.warn("Trailwise native post failed", error);
    nativePort = null;
    return false;
  }
}


async function postBackendEvent(event) {
  for (const url of BACKEND_RECORD_EVENTS_URLS) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ event }),
      });

      const payload = await response.json().catch(() => ({}));

      console.log("Trailwise backend response", {
        url,
        status: response.status,
        payload,
      });

      if (response.ok && payload.ok === true) {
        return true;
      }

      console.warn("Trailwise event not recorded", {
        url,
        status: response.status,
        payload,
      });
    } catch (error) {
      console.debug(
        "Trailwise backend post failed",
        url,
        error,
      );
    }
  }

  return false;
}


/*async function postBackendEvent(event) {
  for (const url of BACKEND_RECORD_EVENTS_URLS) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event })
      });
      if (response.ok) return true;
    } catch (error) {
      console.debug("Trailwise backend post failed", url, error);
    }
  }
  return false;
}*/

/*chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.kind !== "record_event") return false;

  const nativeOk = postNative({
    kind: "record_event",
    event: message.event,
    extension_version: chrome.runtime.getManifest().version,
    tab_id: sender.tab?.id,
    frame_id: sender.frameId
  });

  if (nativeOk) {
    sendResponse({ ok: true, transport: "native" });
    return false;
  }

  void postBackendEvent(message.event).then((ok) => sendResponse({ ok, transport: "backend" }));
  return true;
});*/

chrome.runtime.onMessage.addListener(
  (message, sender, sendResponse) => {
    if (message?.kind !== "record_event") {
      return false;
    }

    void postBackendEvent(message.event).then((backendOk) => {
      if (backendOk) {
        sendResponse({
          ok: true,
          transport: "backend",
        });
        return;
      }

      const nativeOk = postNative({
        kind: "record_event",
        event: message.event,
        extension_version: chrome.runtime.getManifest().version,
        tab_id: sender.tab?.id,
        frame_id: sender.frameId,
      });

      sendResponse({
        ok: nativeOk,
        transport: nativeOk ? "native" : "none",
      });
    });

    return true;
  },
);

chrome.runtime.onInstalled.addListener(() => {
  connectNative();
});
