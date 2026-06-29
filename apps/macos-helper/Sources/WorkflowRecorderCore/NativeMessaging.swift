import Foundation

public enum NativeMessaging {
    public static func readMessage() throws -> NativeMessage? {
        let header = FileHandle.standardInput.readData(ofLength: 4)
        if header.isEmpty { return nil }
        guard header.count == 4 else { return nil }

        let length = header.withUnsafeBytes { pointer in
            pointer.load(as: UInt32.self).littleEndian
        }
        guard length > 0 && length < 10_000_000 else { return nil }

        let data = FileHandle.standardInput.readData(ofLength: Int(length))
        guard data.count == Int(length) else { return nil }
        return try JSONDecoder().decode(NativeMessage.self, from: data)
    }

    public static func write(_ value: [String: Any?]) throws {
        let sanitized = value.compactMapValues { $0 }
        let data = try JSONSerialization.data(withJSONObject: sanitized)
        var length = UInt32(data.count).littleEndian
        let header = Data(bytes: &length, count: 4)
        FileHandle.standardOutput.write(header)
        FileHandle.standardOutput.write(data)
    }
}
