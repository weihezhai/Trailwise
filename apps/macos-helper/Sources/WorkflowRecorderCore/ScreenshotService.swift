import CoreGraphics
import Foundation
#if canImport(ImageIO)
import ImageIO
#endif
#if canImport(ScreenCaptureKit)
import ScreenCaptureKit
#endif
#if canImport(UniformTypeIdentifiers)
import UniformTypeIdentifiers
#endif

public final class ScreenshotService: @unchecked Sendable {
    public init() {}

    public func captureChromeWindow(sessionDirectory: URL, seq: Int, label: String) throws -> String? {
        let fileName = String(format: "%06d-%@.png", seq, safeLabel(label))
        let relative = "screenshots/\(fileName)"
        let destination = sessionDirectory.appendingPathComponent(relative)
        try FileManager.default.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)

        if captureWithScreenCaptureKit(destination: destination) {
            return relative
        }

        guard let windowID = frontChromeWindowID() else { return nil }
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")
        process.arguments = ["-x", "-l", String(windowID), destination.path]
        try process.run()
        process.waitUntilExit()

        return process.terminationStatus == 0 && FileManager.default.fileExists(atPath: destination.path) ? relative : nil
    }

    private func captureWithScreenCaptureKit(destination: URL) -> Bool {
        #if canImport(ScreenCaptureKit) && canImport(ImageIO) && canImport(UniformTypeIdentifiers)
        if #available(macOS 14.0, *) {
            let semaphore = DispatchSemaphore(value: 0)
            var success = false

            Task {
                defer { semaphore.signal() }
                do {
                    let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
                    guard let window = content.windows.first(where: { window in
                        window.owningApplication?.bundleIdentifier == "com.google.Chrome" ||
                        window.owningApplication?.applicationName.contains("Chrome") == true
                    }) else {
                        return
                    }

                    let configuration = SCStreamConfiguration()
                    configuration.width = max(1, Int(window.frame.width))
                    configuration.height = max(1, Int(window.frame.height))
                    configuration.showsCursor = true

                    let filter = SCContentFilter(desktopIndependentWindow: window)
                    let image = try await SCScreenshotManager.captureImage(contentFilter: filter, configuration: configuration)
                    guard let destinationRef = CGImageDestinationCreateWithURL(destination as CFURL, UTType.png.identifier as CFString, 1, nil) else {
                        return
                    }
                    CGImageDestinationAddImage(destinationRef, image, nil)
                    success = CGImageDestinationFinalize(destinationRef)
                } catch {
                    success = false
                }
            }

            _ = semaphore.wait(timeout: .now() + 5)
            return success && FileManager.default.fileExists(atPath: destination.path)
        }
        #endif
        return false
    }

    private func frontChromeWindowID() -> Int? {
        let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
        guard let windows = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] else {
            return nil
        }

        return windows.first { window in
            guard
                let owner = window[kCGWindowOwnerName as String] as? String,
                let layer = window[kCGWindowLayer as String] as? Int
            else {
                return false
            }
            return owner.contains("Chrome") && layer == 0
        }.flatMap { $0[kCGWindowNumber as String] as? Int }
    }

    private func safeLabel(_ value: String) -> String {
        value.lowercased().replacingOccurrences(of: #"[^a-z0-9]+"#, with: "-", options: .regularExpression)
    }
}
