import Foundation

public final class BackendClient: @unchecked Sendable {
    private let config: HelperConfig
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    public init(config: HelperConfig) {
        self.config = config
    }

    public func pair() async throws -> BackendDevice {
        let response: PairResponse = try await post(
            "/helper/pair",
            body: ["device_id": config.deviceID, "name": config.deviceName]
        )
        return response.device
    }

    public func pendingSessions() async throws -> [BackendSession] {
        let path = "/helper/sessions/pending?device_id=\(config.deviceID.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? config.deviceID)"
        let response: PendingSessionsResponse = try await get(path)
        return response.sessions
    }

    public func session(_ sessionID: String) async throws -> BackendSession {
        let response: SessionResponse = try await get("/helper/sessions/\(sessionID)")
        return response.session
    }

    public func confirm(sessionID: String) async throws {
        let _: SessionResponse = try await post("/helper/sessions/\(sessionID)/confirm", body: EmptyBody())
    }

    public func cancel(sessionID: String) async throws {
        let _: SessionResponse = try await post("/helper/sessions/\(sessionID)/cancel", body: EmptyBody())
    }

    public func stopped(sessionID: String) async throws {
        let _: SessionResponse = try await post("/helper/sessions/\(sessionID)/stopped", body: EmptyBody())
    }

    public func summary(sessionID: String, summary: SessionSummary) async throws {
        let _: SessionResponse = try await post("/helper/sessions/\(sessionID)/summary", body: summary)
    }

    private func get<T: Decodable>(_ path: String) async throws -> T {
        var request = URLRequest(url: config.backendBaseURL.appendingPathComponent(path))
        if path.hasPrefix("/") {
            request = URLRequest(url: URL(string: String(path.dropFirst()), relativeTo: config.backendBaseURL)!)
        }
        request.setValue(config.helperSecret, forHTTPHeaderField: "x-helper-secret")
        let (data, response) = try await URLSession.shared.data(for: request)
        try Self.validate(response: response, data: data)
        return try decoder.decode(T.self, from: data)
    }

    private func post<T: Decodable, B: Encodable>(_ path: String, body: B) async throws -> T {
        var request = URLRequest(url: URL(string: String(path.dropFirst()), relativeTo: config.backendBaseURL)!)
        request.httpMethod = "POST"
        request.setValue(config.helperSecret, forHTTPHeaderField: "x-helper-secret")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try encoder.encode(body)
        let (data, response) = try await URLSession.shared.data(for: request)
        try Self.validate(response: response, data: data)
        return try decoder.decode(T.self, from: data)
    }

    private static func validate(response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let text = String(data: data, encoding: .utf8) ?? "<non-utf8>"
            throw HelperError.backend("Backend request failed: \(text)")
        }
    }
}

private struct EmptyBody: Encodable {}

public enum HelperError: Error, CustomStringConvertible {
    case backend(String)
    case invalidState(String)

    public var description: String {
        switch self {
        case .backend(let message), .invalidState(let message):
            return message
        }
    }
}
