// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "WorkflowRecorderHelper",
    platforms: [.macOS(.v13)],
    products: [
        .executable(name: "workflow-recorder-helper", targets: ["WorkflowRecorderHelper"]),
        .executable(name: "workflow-recorder-native-host", targets: ["WorkflowRecorderNativeHost"])
    ],
    targets: [
        .target(name: "WorkflowRecorderCore"),
        .executableTarget(
            name: "WorkflowRecorderHelper",
            dependencies: ["WorkflowRecorderCore"]
        ),
        .executableTarget(
            name: "WorkflowRecorderNativeHost",
            dependencies: ["WorkflowRecorderCore"]
        )
    ]
)
