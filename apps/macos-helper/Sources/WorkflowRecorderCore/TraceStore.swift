import Foundation

public final class TraceStore: @unchecked Sendable {
    private let config: HelperConfig
    private let encoder: JSONEncoder
    private let decoder = JSONDecoder()

    public init(config: HelperConfig) {
        self.config = config
        self.encoder = JSONEncoder()
        self.encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
    }

    public var sessionsDirectory: URL {
        config.dataDirectory.appendingPathComponent("sessions", isDirectory: true)
    }

    public var activeSessionURL: URL {
        config.dataDirectory.appendingPathComponent("active-session.json")
    }

    public func start(session: BackendSession) throws -> ActiveSession {
        try sessionsDirectory.ensuringDirectory()
        let sessionDirectory = try sessionsDirectory.appendingPathComponent(session.session_id, isDirectory: true).ensuringDirectory()
        try sessionDirectory.appendingPathComponent("screenshots", isDirectory: true).ensuringDirectory()
        try sessionDirectory.appendingPathComponent("dom", isDirectory: true).ensuringDirectory()
        try sessionDirectory.appendingPathComponent("generated", isDirectory: true).ensuringDirectory()

        let now = isoNow()
        let active = ActiveSession(
            session_id: session.session_id,
            target_url: session.target_url,
            started_at: now,
            session_directory: sessionDirectory.path,
            screenshots_enabled: config.screenshotsEnabled
        )
        let trace = WorkflowTrace(
            schema_version: "0.1",
            session_id: session.session_id,
            platform: "macos",
            browser: "chrome",
            started_at: now,
            target_url: session.target_url,
            stopped_at: nil,
            duration_ms: nil,
            redacted_values: nil,
            events: [
                TraceEvent(
                    seq: 1,
                    type: "session_started",
                    ts: 0,
                    url: session.target_url,
                    title: nil,
                    selector: nil,
                    role: nil,
                    label: nil,
                    text: nil,
                    screenshot: nil,
                    value_policy: "none",
                    value: nil,
                    element: nil
                )
            ]
        )

        try write(trace, to: traceURL(active: active))
        try write(active, to: activeSessionURL)
        try write(["session_id": session.session_id, "target_url": session.target_url, "started_at": now], to: sessionDirectory.appendingPathComponent("metadata.json"))
        return active
    }

    public func activeSession() throws -> ActiveSession? {
        guard FileManager.default.fileExists(atPath: activeSessionURL.path) else { return nil }
        let data = try Data(contentsOf: activeSessionURL)
        return try decoder.decode(ActiveSession.self, from: data)
    }

    public func append(event input: TraceEvent, screenshotService: ScreenshotService? = nil) throws -> TraceEvent? {
        guard let active = try activeSession() else { return nil }
        guard urlIsAllowed(input.url, target: active.target_url) else { return nil }

        var trace = try readTrace(active: active)
        var event = sanitize(input)
        event.seq = trace.events.count + 1
        if event.ts == 0 {
            event.ts = elapsedMilliseconds(since: trace.started_at)
        }

        if active.screenshots_enabled, shouldCaptureScreenshot(for: event), let service = screenshotService {
            event.screenshot = try? service.captureChromeWindow(sessionDirectory: URL(fileURLWithPath: active.session_directory), seq: event.seq, label: event.type)
        }

        trace.events.append(event)
        try write(trace, to: traceURL(active: active))
        return event
    }

    public func finalize(sessionID: String, cancelled: Bool = false) throws -> SessionSummary {
        guard let active = try activeSession(), active.session_id == sessionID else {
            throw HelperError.invalidState("No active local session for \(sessionID)")
        }

        var trace = try readTrace(active: active)
        let duration = elapsedMilliseconds(since: trace.started_at)
        trace.stopped_at = isoNow()
        trace.duration_ms = duration
        trace.events.append(
            TraceEvent(
                seq: trace.events.count + 1,
                type: cancelled ? "session_cancelled" : "session_stopped",
                ts: duration,
                url: trace.events.last?.url ?? trace.target_url,
                title: nil,
                selector: nil,
                role: nil,
                label: nil,
                text: nil,
                screenshot: nil,
                value_policy: "none",
                value: nil,
                element: nil
            )
        )
        try write(trace, to: traceURL(active: active))
        try? FileManager.default.removeItem(at: activeSessionURL)

        return SessionSummary(
            session_id: sessionID,
            duration_ms: duration,
            url_start: trace.target_url,
            url_end: trace.events.reversed().first(where: { $0.url != nil })?.url,
            events_count: trace.events.filter { !["session_started", "session_stopped", "session_cancelled"].contains($0.type) }.count,
            screenshots_count: trace.events.filter { $0.screenshot != nil }.count,
            redactions_count: trace.events.filter { $0.value_policy == "redacted" }.count,
            trace_path: traceURL(active: active).path
        )
    }

    public func delete(sessionID: String) throws {
        let directory = sessionsDirectory.appendingPathComponent(sessionID, isDirectory: true)
        try? FileManager.default.removeItem(at: directory)
        if let active = try activeSession(), active.session_id == sessionID {
            try? FileManager.default.removeItem(at: activeSessionURL)
        }
    }

    private func readTrace(active: ActiveSession) throws -> WorkflowTrace {
        let data = try Data(contentsOf: traceURL(active: active))
        return try decoder.decode(WorkflowTrace.self, from: data)
    }

    private func traceURL(active: ActiveSession) -> URL {
        URL(fileURLWithPath: active.session_directory).appendingPathComponent("trace.json")
    }

    private func write<T: Encodable>(_ value: T, to url: URL) throws {
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try encoder.encode(value).write(to: url, options: .atomic)
    }
}

private func sanitize(_ input: TraceEvent) -> TraceEvent {
    var event = input
    let combined = [
        event.selector,
        event.label,
        event.text,
        event.element?.selector,
        event.element?.name,
        event.element?.id,
        event.element?.placeholder,
        event.element?.label,
        event.element?.type
    ].compactMap { $0 }.joined(separator: " ")

    if event.type == "input" {
        if combined.range(of: #"password|token|secret|api[_-]?key|credit|card|otp|ssn|security\s*code|cvv"#, options: [.regularExpression, .caseInsensitive]) != nil {
            event.value_policy = "redacted"
            event.value = "[REDACTED]"
        } else if event.value_policy == nil || event.value_policy == "none" {
            event.value_policy = "typed_text_placeholder"
            event.value = "[TYPED_TEXT]"
        }
    }

    return event
}

private func urlIsAllowed(_ eventURL: String?, target: String) -> Bool {
    guard let eventURL, let event = URL(string: eventURL), let targetURL = URL(string: target) else {
        return true
    }
    return event.scheme == targetURL.scheme && event.host == targetURL.host && event.port == targetURL.port
}

private func shouldCaptureScreenshot(for event: TraceEvent) -> Bool {
    ["session_started", "navigation", "click", "submit", "session_stopped"].contains(event.type)
}

private func isoNow() -> String {
    ISO8601DateFormatter().string(from: Date())
}

private func elapsedMilliseconds(since isoDate: String) -> Int {
    let start = ISO8601DateFormatter().date(from: isoDate) ?? Date()
    return max(0, Int(Date().timeIntervalSince(start) * 1000))
}
