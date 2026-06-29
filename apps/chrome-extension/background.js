const HOST_NAME = "com.trailwise.workflow_recorder";
let nativePort = null;
let connecting = false;

function connectNative() {
  if (nativePort || connecting) return nativePort;
  connecting = true;
  try {
    nativePort = chrome.runtime.connectNative(HOST_NAME);
    nativePort.onDisconnect.addListener(() => {
      const message = chrome.runtime.lastError?.message;
      if (message) console.warn(`Trailwise native host disconnected: ${message}`);
      nativePort = null;
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
  } finally {
    connecting = false;
  }
  return nativePort;
}

function postNative(message) {
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.kind !== "record_event") return false;

  const ok = postNative({
    kind: "record_event",
    event: message.event,
    extension_version: chrome.runtime.getManifest().version,
    tab_id: sender.tab?.id,
    frame_id: sender.frameId
  });

  sendResponse({ ok });
  return false;
});

chrome.runtime.onInstalled.addListener(() => {
  connectNative();
});
