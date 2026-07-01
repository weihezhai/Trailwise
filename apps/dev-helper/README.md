# Trailwise Dev Helper

This is a TypeScript fallback helper for local development and verification. It implements the same backend helper API, local trace storage, and Native Messaging protocol as the Swift macOS helper.

Use it when the Swift helper cannot be built locally because Xcode/CommandLineTools are unavailable or mismatched.

## Commands

Build:

```bash
npm run build -w @trailwise/dev-helper
```

Pair helper:

```bash
npm run cli -w @trailwise/dev-helper -- pair
```

Accept the next pending session without an interactive prompt:

```bash
npm run cli -w @trailwise/dev-helper -- accept-next
```

Append a synthetic event for smoke testing:

```bash
npm run cli -w @trailwise/dev-helper -- append-event '{"type":"click","ts":1,"url":"http://localhost:5173","selector":"[data-testid=\"create-account\"]"}'
```

Finalize the active session:

```bash
npm run cli -w @trailwise/dev-helper -- stop-active
```

Install a Native Messaging manifest pointing at the built TypeScript native host:

```bash
npm run build -w @trailwise/dev-helper
npm run cli -w @trailwise/dev-helper -- install-native-host --extension-id <extension-id>
```
