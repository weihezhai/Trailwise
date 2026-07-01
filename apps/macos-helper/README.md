# macOS Helper

This is the MVP macOS helper shell for Trailwise. It is a Swift command-line helper that owns local confirmation, session files, Native Messaging host installation, and optional selected Chrome-window screenshots.

It intentionally does not request Accessibility permission and does not control Chrome beyond opening the target URL after local consent.

## Build

```bash
./scripts/build.sh
```

## Run

```bash
.build/debug/workflow-recorder-helper run
```

Useful environment variables:

```text
BACKEND_BASE_URL=http://localhost:3000
HELPER_PAIRING_SECRET=dev-helper-secret
HELPER_DEVICE_ID=local-mac
TRAILWISE_DATA_DIR=../../.trailwise-data
WORKFLOW_RECORDER_SCREENSHOTS=0
```

## Install Native Messaging Host

After loading the unpacked Chrome extension, copy its extension ID and run:

```bash
.build/debug/workflow-recorder-helper install-native-host --extension-id <extension-id>
```

The manifest is written to:

```text
~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.trailwise.workflow_recorder.json
```

For local development, the manifest points at `.build/debug/workflow-recorder-native-host`.

## Screenshot Mode

Screenshots are disabled by default. Enable them with:

```bash
WORKFLOW_RECORDER_SCREENSHOTS=1 .build/debug/workflow-recorder-helper run
```

The MVP captures the frontmost visible Google Chrome window with ScreenCaptureKit when available, and falls back to macOS window capture for development builds. If Screen Recording permission is denied, DOM recording still works and the helper reports screenshots as disabled.
