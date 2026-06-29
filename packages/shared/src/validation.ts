import AjvModule, { type ErrorObject, type ValidateFunction } from "ajv";
import { eventLooksSensitive, type TraceEvent, type WorkflowTrace } from "./trace.js";
import { traceSchema } from "./trace-schema.js";

const Ajv = AjvModule as unknown as new (options: { allErrors: boolean }) => {
  compile<T>(schema: unknown): ValidateFunction<T>;
};
const ajv = new Ajv({ allErrors: true });
const validateSchema = ajv.compile<WorkflowTrace>(traceSchema);

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateTrace(input: unknown): ValidationResult {
  const errors: string[] = [];
  if (!validateSchema(input)) {
    errors.push(...(validateSchema.errors ?? []).map((error: ErrorObject) => `${error.instancePath || "/"} ${error.message ?? ""}`));
  }

  if (isWorkflowTraceLike(input)) {
    errors.push(...validateTraceSecurity(input));
    errors.push(...validateTraceSequence(input.events));
  }

  return { valid: errors.length === 0, errors };
}

export function validateTraceSecurity(trace: WorkflowTrace): string[] {
  const errors: string[] = [];

  for (const event of trace.events) {
    if (event.type !== "input") continue;

    const policy = event.value_policy ?? "none";
    if (eventLooksSensitive(event) && policy !== "redacted" && policy !== "synthetic") {
      errors.push(`event ${event.seq} appears sensitive but uses value_policy=${policy}`);
    }

    if (policy === "redacted" && event.value !== "[REDACTED]") {
      errors.push(`event ${event.seq} is redacted but value is not [REDACTED]`);
    }
  }

  return errors;
}

function validateTraceSequence(events: TraceEvent[]): string[] {
  const errors: string[] = [];
  events.forEach((event, index) => {
    const expected = index + 1;
    if (event.seq !== expected) {
      errors.push(`event sequence mismatch at index ${index}: expected ${expected}, received ${event.seq}`);
    }
  });
  return errors;
}

function isWorkflowTraceLike(input: unknown): input is WorkflowTrace {
  return Boolean(input && typeof input === "object" && Array.isArray((input as { events?: unknown }).events));
}
