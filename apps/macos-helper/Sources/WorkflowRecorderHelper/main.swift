import Foundation
#if canImport(WorkflowRecorderCore)
import WorkflowRecorderCore
#endif

@main
struct WorkflowRecorderHelperMain {
    static func main() async throws {
        let args = CommandLine.arguments.dropFirst()
        let command = args.first ?? "help"
        let config = HelperConfig.load()

        switch command {
        case "run":
            try await HelperRunner(config: config).run()
        case "install-native-host":
            let extensionID = parseOption(args: Array(args), name: "--extension-id")
            guard let extensionID, !extensionID.isEmpty else {
                print("Usage: workflow-recorder-helper install-native-host --extension-id <chrome-extension-id>")
                Foundation.exit(2)
            }
            try installNativeHost(extensionID: extensionID)
        case "finalize":
            guard let sessionID = args.dropFirst().first else {
                print("Usage: workflow-recorder-helper finalize <session-id>")
                Foundation.exit(2)
            }
            let store = TraceStore(config: config)
            let summary = try store.finalize(sessionID: String(sessionID))
            try await BackendClient(config: config).summary(sessionID: String(sessionID), summary: summary)
            print("Finalized \(sessionID)")
        default:
            print("""
            Usage:
              workflow-recorder-helper run
              workflow-recorder-helper install-native-host --extension-id <chrome-extension-id>
              workflow-recorder-helper finalize <session-id>
            """)
        }
    }
}

private final class HelperRunner {
    private let config: HelperConfig
    private let client: BackendClient
    private let store: TraceStore

    init(config: HelperConfig) {
        self.config = config
        self.client = BackendClient(config: config)
        self.store = TraceStore(config: config)
    }

    func run() async throws {
        try config.dataDirectory.ensuringDirectory()
        let device = try await client.pair()
        print("Paired helper: \(device.name) (\(device.device_id))")
        print("Polling \(config.backendBaseURL.absoluteString) for sessions. Press Ctrl-C to exit.")
        if config.screenshotsEnabled {
            print("Screenshots enabled. macOS may require Screen Recording permission.")
        } else {
            print("Screenshots disabled. Set WORKFLOW_RECORDER_SCREENSHOTS=1 to enable.")
        }

        while true {
            do {
                if let active = try store.activeSession() {
                    let session = try await client.session(active.session_id)
                    if session.status == "stopping" {
                        let summary = try store.finalize(sessionID: active.session_id)
                        try await client.summary(sessionID: active.session_id, summary: summary)
                        print("Recording complete: \(active.session_id)")
                    } else if session.status == "deleted" {
                        try store.delete(sessionID: active.session_id)
                        print("Deleted local recording artifacts for \(active.session_id)")
                    }
                } else {
                    for session in try await client.pendingSessions() {
                        if session.status == "pending_local_confirmation" {
                            try await confirm(session: session)
                        } else if session.status == "deleted" {
                            try store.delete(sessionID: session.session_id)
                            print("Deleted local recording artifacts for \(session.session_id)")
                        }
                    }
                }
            } catch {
                print("Helper warning: \(error)")
            }

            try await Task.sleep(nanoseconds: 2_000_000_000)
        }
    }

    private func confirm(session: BackendSession) async throws {
        print("""

        Start recording Chrome workflow?

        Target:
        \(session.target_url)

        Captured:
        - clicks
        - page URLs
        - DOM selectors
        - redacted form interactions
        \(config.screenshotsEnabled ? "- screenshots of the selected Chrome window" : "- screenshots disabled")

        Not captured:
        - passwords
        - hidden input values
        - other apps
        - full screen unless screenshots are explicitly enabled

        Type "start" to begin or anything else to cancel:
        """)

        let answer = readLine()?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard answer == "start" else {
            try await client.cancel(sessionID: session.session_id)
            print("Cancelled \(session.session_id)")
            return
        }

        _ = try store.start(session: session)
        try await client.confirm(sessionID: session.session_id)
        openChrome(url: session.target_url)
        print("Recording \(session.session_id). Stop from Slack or run the simulated stop command.")
    }

    private func openChrome(url: String) {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/open")
        process.arguments = ["-a", "Google Chrome", url]
        try? process.run()
    }
}

private func installNativeHost(extensionID: String) throws {
    let buildDir = URL(fileURLWithPath: FileManager.default.currentDirectoryPath).appendingPathComponent(".build/debug")
    let nativeHostPath = buildDir.appendingPathComponent("workflow-recorder-native-host").path
    let manifest: [String: Any] = [
        "name": "com.trailwise.workflow_recorder",
        "description": "Trailwise Workflow Recorder Native Host",
        "path": nativeHostPath,
        "type": "stdio",
        "allowed_origins": ["chrome-extension://\(extensionID)/"]
    ]

    let destination = FileManager.default
        .urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        .appendingPathComponent("Google/Chrome/NativeMessagingHosts/com.trailwise.workflow_recorder.json")
    try FileManager.default.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
    let data = try JSONSerialization.data(withJSONObject: manifest, options: [.prettyPrinted, .sortedKeys])
    try data.write(to: destination, options: .atomic)
    print("Installed Native Messaging manifest at \(destination.path)")
    print("Native host path: \(nativeHostPath)")
}

private func parseOption(args: [String], name: String) -> String? {
    guard let index = args.firstIndex(of: name), args.indices.contains(index + 1) else { return nil }
    return args[index + 1]
}
