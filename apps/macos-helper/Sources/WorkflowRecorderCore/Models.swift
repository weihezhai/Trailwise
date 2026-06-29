import Foundation

public struct BackendDevice: Codable, Sendable {
    public let device_id: String
    public let name: String
}

public struct BackendSession: Codable, Sendable {
    public let session_id: String
    public let target_url: String
    public let status: String
}

public struct PendingSessionsResponse: Codable, Sendable {
    public let sessions: [BackendSession]
}

public struct PairResponse: Codable, Sendable {
    public let device: BackendDevice
}

public struct SessionResponse: Codable, Sendable {
    public let session: BackendSession
}

public struct SessionSummary: Codable, Sendable {
    public let session_id: String
    public let duration_ms: Int
    public let url_start: String?
    public let url_end: String?
    public let events_count: Int
    public let screenshots_count: Int
    public let redactions_count: Int
    public let trace_path: String?
}

public struct ActiveSession: Codable, Sendable {
    public let session_id: String
    public let target_url: String
    public let started_at: String
    public let session_directory: String
    public let screenshots_enabled: Bool
}

public struct WorkflowTrace: Codable, Sendable {
    public var schema_version: String
    public var session_id: String
    public var platform: String
    public var browser: String
    public var started_at: String
    public var target_url: String
    public var stopped_at: String?
    public var duration_ms: Int?
    public var redacted_values: [RedactedValueHint]?
    public var events: [TraceEvent]
}

public struct RedactedValueHint: Codable, Sendable {
    public let field: String
    public let suggested_test_value: String
}

public struct TraceEvent: Codable, Sendable {
    public var seq: Int
    public var type: String
    public var ts: Int
    public var url: String?
    public var title: String?
    public var selector: String?
    public var role: String?
    public var label: String?
    public var text: String?
    public var screenshot: String?
    public var value_policy: String?
    public var value: String?
    public var element: ElementMetadata?
}

public struct ElementMetadata: Codable, Sendable {
    public var tag: String?
    public var selector: String?
    public var text: String?
    public var ariaLabel: String?
    public var role: String?
    public var type: String?
    public var name: String?
    public var id: String?
    public var placeholder: String?
    public var label: String?
    public var boundingClientRect: BoundingClientRect?
}

public struct BoundingClientRect: Codable, Sendable {
    public var x: Double?
    public var y: Double?
    public var width: Double?
    public var height: Double?
    public var top: Double?
    public var right: Double?
    public var bottom: Double?
    public var left: Double?
}

public struct NativeMessage: Codable, Sendable {
    public var kind: String
    public var session_id: String?
    public var event: TraceEvent?
    public var extension_version: String?
    public var tab_id: Int?
    public var frame_id: Int?
}
