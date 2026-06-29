import Foundation
#if canImport(WorkflowRecorderCore)
import WorkflowRecorderCore
#endif

let config = HelperConfig.load()
let store = TraceStore(config: config)
let screenshots = config.screenshotsEnabled ? ScreenshotService() : nil

while let message = try NativeMessaging.readMessage() {
    switch message.kind {
    case "health_check":
        try NativeMessaging.write(["ok": true, "kind": "health_check_response"])
    case "session_status":
        let active = try store.activeSession()
        try NativeMessaging.write([
            "ok": true,
            "kind": "session_status",
            "session_id": active?.session_id,
            "recording": active != nil
        ])
    case "record_event":
        if let event = message.event, let appended = try store.append(event: event, screenshotService: screenshots) {
            try NativeMessaging.write([
                "ok": true,
                "kind": "record_event_ack",
                "session_id": message.session_id,
                "seq": appended.seq
            ])
        } else {
            try NativeMessaging.write([
                "ok": false,
                "kind": "record_event_ignored",
                "reason": "no active session or disallowed origin"
            ])
        }
    default:
        try NativeMessaging.write(["ok": false, "kind": "unknown_message", "received": message.kind])
    }
}
