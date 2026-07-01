# Trailwise Chrome Extension

This Manifest V3 extension records DOM-level workflow events on allowlisted demo origins and forwards them to the macOS helper through Chrome Native Messaging.

## Load Locally

1. Open `chrome://extensions`.
2. Enable Developer Mode.
3. Click "Load unpacked".
4. Select `apps/chrome-extension`.
5. Copy the generated extension ID.
6. Install the Native Messaging manifest:

```bash
cd apps/macos-helper
swift run workflow-recorder-helper install-native-host --extension-id <extension-id>
```

## Permissions

The MVP is allowlisted to:

- `http://localhost/*`
- `http://127.0.0.1/*`
- `https://demo.yourapp.com/*`

Do not change this to `https://*/*` for the demo.

