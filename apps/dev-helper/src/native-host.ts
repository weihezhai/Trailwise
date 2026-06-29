#!/usr/bin/env node
import { loadConfig } from "./config.js";
import { readNativeMessages, writeNativeMessage } from "./native-protocol.js";
import { TraceStore } from "./trace-store.js";

const store = new TraceStore(loadConfig());

for await (const message of readNativeMessages()) {
  if (message.kind === "health_check") {
    writeNativeMessage({ ok: true, kind: "health_check_response" });
    continue;
  }

  if (message.kind === "session_status") {
    const active = store.activeSession();
    writeNativeMessage({ ok: true, kind: "session_status", recording: Boolean(active), session_id: active?.session_id });
    continue;
  }

  if (message.kind === "record_event") {
    const appended = store.append(message.event ?? {});
    writeNativeMessage(
      appended
        ? { ok: true, kind: "record_event_ack", seq: appended.seq }
        : { ok: false, kind: "record_event_ignored", reason: "no active session or disallowed origin" }
    );
    continue;
  }

  writeNativeMessage({ ok: false, kind: "unknown_message", received: message.kind });
}
