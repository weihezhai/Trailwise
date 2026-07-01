import type { JSONSchemaType } from "ajv";
import type { WorkflowTrace } from "./trace.js";

export const traceSchema: JSONSchemaType<WorkflowTrace> = {
  type: "object",
  additionalProperties: false,
  required: ["schema_version", "session_id", "platform", "browser", "started_at", "target_url", "events"],
  properties: {
    schema_version: { const: "0.1", type: "string" },
    session_id: { type: "string", minLength: 1 },
    platform: { const: "macos", type: "string" },
    browser: { const: "chrome", type: "string" },
    started_at: { type: "string", minLength: 1 },
    target_url: { type: "string", minLength: 1 },
    stopped_at: { type: "string", nullable: true },
    duration_ms: { type: "number", nullable: true },
    video_path: { type: "string", nullable: true },
    redacted_values: {
      type: "array",
      nullable: true,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["field", "suggested_test_value"],
        properties: {
          field: { type: "string" },
          suggested_test_value: { type: "string" }
        }
      }
    },
    events: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["seq", "type", "ts"],
        properties: {
          seq: { type: "integer", minimum: 1 },
          type: {
            type: "string",
            enum: ["session_started", "navigation", "click", "input", "submit", "session_stopped", "session_cancelled"]
          },
          ts: { type: "number", minimum: 0 },
          url: { type: "string", nullable: true },
          title: { type: "string", nullable: true },
          selector: { type: "string", nullable: true },
          role: { type: "string", nullable: true },
          label: { type: "string", nullable: true },
          text: { type: "string", nullable: true },
          screenshot: { type: "string", nullable: true },
          value_policy: {
            type: "string",
            enum: ["none", "redacted", "synthetic", "typed_text_placeholder"],
            nullable: true
          },
          value: { type: "string", nullable: true },
          element: {
            type: "object",
            nullable: true,
            additionalProperties: false,
            required: [],
            properties: {
              tag: { type: "string", nullable: true },
              selector: { type: "string", nullable: true },
              text: { type: "string", nullable: true },
              ariaLabel: { type: "string", nullable: true },
              role: { type: "string", nullable: true },
              type: { type: "string", nullable: true },
              name: { type: "string", nullable: true },
              id: { type: "string", nullable: true },
              placeholder: { type: "string", nullable: true },
              label: { type: "string", nullable: true },
              boundingClientRect: {
                type: "object",
                nullable: true,
                additionalProperties: false,
                required: [],
                properties: {
                  x: { type: "number", nullable: true },
                  y: { type: "number", nullable: true },
                  width: { type: "number", nullable: true },
                  height: { type: "number", nullable: true },
                  top: { type: "number", nullable: true },
                  right: { type: "number", nullable: true },
                  bottom: { type: "number", nullable: true },
                  left: { type: "number", nullable: true }
                }
              }
            }
          }
        }
      }
    }
  }
};
