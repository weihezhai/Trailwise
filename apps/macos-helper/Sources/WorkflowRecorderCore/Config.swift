import Foundation

public struct HelperConfig: Sendable {
    public let backendBaseURL: URL
    public let helperSecret: String
    public let deviceID: String
    public let deviceName: String
    public let dataDirectory: URL
    public let screenshotsEnabled: Bool

    public static func load(environment: [String: String] = ProcessInfo.processInfo.environment) -> HelperConfig {
        let backend = URL(string: environment["BACKEND_BASE_URL"] ?? "http://localhost:3000")!
        let cwd = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
        let dataDirectory: URL
        if let value = environment["TRAILWISE_DATA_DIR"], !value.isEmpty {
            dataDirectory = URL(fileURLWithPath: value, relativeTo: cwd).standardizedFileURL
        } else {
            let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            dataDirectory = appSupport.appendingPathComponent("WorkflowRecorder", isDirectory: true)
        }

        return HelperConfig(
            backendBaseURL: backend,
            helperSecret: environment["HELPER_PAIRING_SECRET"] ?? "dev-helper-secret",
            deviceID: environment["HELPER_DEVICE_ID"] ?? Host.current().localizedName?.replacingOccurrences(of: " ", with: "-").lowercased() ?? "local-mac",
            deviceName: environment["HELPER_DEVICE_NAME"] ?? Host.current().localizedName ?? "Local Mac",
            dataDirectory: dataDirectory,
            screenshotsEnabled: environment["WORKFLOW_RECORDER_SCREENSHOTS"] == "1"
        )
    }
}

public extension URL {
    func ensuringDirectory() throws -> URL {
        try FileManager.default.createDirectory(at: self, withIntermediateDirectories: true)
        return self
    }
}
