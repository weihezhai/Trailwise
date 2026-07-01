# Trailwise

Trailwise is a local macOS + Chrome workflow recording demo.

The current implementation can:

1. Open a browser session for `expense-flow.html`.
2. Record the browser as a `.webm` video.
3. Capture a structured trace of clicks, inputs, selectors, labels, and page state.
4. Ask Codex CLI to analyze sampled video frames plus the trace.
5. Write a generated `SKILL.md` and `replay.json`.
6. Replay the learned workflow later in Chrome or Chromium with new inputs, such as approving or escalating a different expense.

This is a repo-local implementation of the workflow. It does not depend on the gated Codex desktop Record & Replay feature.

## Requirements

- macOS
- Node.js
- Chrome or Chromium
- Codex CLI available as `codex`
- `ffmpeg` for extracting sampled frames from recorded `.webm` video

Install dependencies:

```bash
npm install
```

Optional local environment:

```bash
cp .env.example .env
```

Keep real Slack tokens and other secrets only in `.env` or `.env.local`.

## Run The Demo

Start the sample website:

```bash
npm run dev:demo
```

Open:

```text
http://localhost:5173/expense-flow.html
```

Start the backend:

```bash
npm run dev:backend
```

The backend defaults to:

```text
http://localhost:3100
```

## Record A Workflow

Create a recording session:

```bash
curl -X POST http://localhost:3100/dev/slack-command \
  -H 'content-type: application/json' \
  -d '{"text":"start http://localhost:5173/expense-flow.html"}'
```

Start browser capture:

```bash
TRAILWISE_BROWSER_CAPTURE=1 npm run dev:helper:capture
```

This opens the target page in a recorded browser context. Perform one workflow, for example:

1. Select `EXP-4821`.
2. Click `Approve`.

Stop the recording:

```bash
curl -X POST http://localhost:3100/dev/slack-command \
  -H 'content-type: application/json' \
  -d '{"text":"stop"}'
```

The completed session is written under:

```text
.trailwise-data/sessions/<session-id>/
```

Important files:

```text
trace.json
video/*.webm
```

## Generate A Codex Skill

Generate a skill from the latest completed recording:

```bash
curl -X POST http://localhost:3100/dev/slack-command \
  -H 'content-type: application/json' \
  -d '{"text":"generate-skill"}'
```

Or generate directly by session id:

```bash
curl -X POST http://localhost:3100/sessions/<session-id>/generate-skill \
  -H 'content-type: application/json'
```

Generated files:

```text
.trailwise-data/sessions/<session-id>/generated/skill/SKILL.md
.trailwise-data/sessions/<session-id>/generated/skill/replay.json
.trailwise-data/sessions/<session-id>/generated/skill/video-frames/*.png
.trailwise-data/sessions/<session-id>/generated/skill/skill-generation-response.json
```

In `CODEX_GENERATION_MODE=sdk`, the backend samples frames from the recorded video and passes them to `codex exec --image`. If Codex CLI fails, times out, or is unavailable, Trailwise falls back to a deterministic generated skill so replay still works.

## Replay The Skill

Replay against a different expense and decision:

```bash
npm run replay:skill -- --skill .trailwise-data/sessions/<session-id>/generated/skill \
  --target-url http://localhost:5173/expense-flow.html \
  --expense-id EXP-4824 \
  --decision escalate \
  --browser-channel chrome
```

For headless verification with Playwright Chromium:

```bash
npm run replay:skill -- --skill .trailwise-data/sessions/<session-id>/generated/skill \
  --target-url http://localhost:5173/expense-flow.html \
  --expense-id EXP-4824 \
  --decision escalate \
  --headless \
  --browser-channel chromium \
  --slow-mo 0
```

Expected result for the sample demo:

```text
EXP-4824 -> Escalated
resolved_text -> Sent to human review
```

## Chrome Extension And Native Host

The browser-capture path above does not require the Chrome extension. It uses Playwright to launch a recorded browser context and inject the recorder.

The extension/native-host path is still available for testing the Chrome extension integration:

```bash
npm run helper:install-native-host
```

Then load the extension from:

```text
apps/chrome-extension
```

Chrome extension ID is pinned in the manifest and `.env.example`:

```text
mgogpbllddkpobdpcgckekigobdklaoh
```

If native messaging is unavailable, the extension can post recorded events to the backend fallback endpoint:

```text
POST /record/events
```

## Useful Commands

```bash
npm run typecheck
npm test
npm run build
```

Run the helper CLI directly:

```bash
npm run cli -w @trailwise/dev-helper -- pending
npm run cli -w @trailwise/dev-helper -- capture-next
npm run cli -w @trailwise/dev-helper -- replay-latest --expense-id EXP-4824 --decision escalate
```

Use Chromium instead of Chrome:

```bash
TRAILWISE_BROWSER_CHANNEL=chromium TRAILWISE_BROWSER_HEADLESS=1 TRAILWISE_BROWSER_SLOW_MO=0 \
  TRAILWISE_BROWSER_CAPTURE=1 npm run dev:helper:capture
```

## Safety

- Recording only starts after a local helper accepts a pending session.
- Recording is scoped to allowed origins.
- Sensitive inputs are redacted or replaced with typed-text placeholders.
- Video, traces, generated skills, and replay metadata stay local under `.trailwise-data/`.
- Do not replay against production finance data without explicit confirmation.

