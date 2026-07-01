import { existsSync, mkdirSync } from "node:fs";
import { join, relative } from "node:path";
import { chromium, type BrowserContext, type Page, type Video } from "playwright";
import type { TraceEvent } from "@trailwise/shared";
import type { BackendSession } from "./backend-client.js";
import type { DevHelperConfig } from "./config.js";
import type { ActiveSession, TraceStore } from "./trace-store.js";

export class BrowserCaptureController {
  private context?: BrowserContext;
  private active?: ActiveSession;
  private videos: Video[] = [];

  constructor(
    private readonly config: DevHelperConfig,
    private readonly store: TraceStore
  ) {}

  isActive(): boolean {
    return Boolean(this.context);
  }

  async start(session: BackendSession): Promise<ActiveSession> {
    if (this.context) throw new Error("Browser capture is already active");

    const active = this.store.start(session);
    const videoDir = join(active.session_directory, "video");
    mkdirSync(videoDir, { recursive: true });

    const args = ["--no-first-run", "--no-default-browser-check"];
    if (this.config.browserRemoteDebuggingPort) {
      args.push(`--remote-debugging-port=${this.config.browserRemoteDebuggingPort}`);
    }

    const context = await chromium.launchPersistentContext(join(this.config.chromeUserDataDir, session.session_id), {
      channel: this.config.browserChannel,
      headless: this.config.browserHeadless,
      slowMo: this.config.browserSlowMo,
      recordVideo: {
        dir: videoDir,
        size: { width: 1280, height: 720 }
      },
      args
    });

    await context.exposeBinding("trailwiseRecordEvent", async (_source, event: Partial<TraceEvent>) => {
      return Boolean(this.store.append(event));
    });
    await context.addInitScript({ content: recorderInitScript() });
    context.on("page", (page) => this.trackPage(page));

    const page = await context.newPage();
    this.trackPage(page);
    await page.goto(session.target_url);

    this.context = context;
    this.active = active;
    return active;
  }

  async stop(): Promise<string | undefined> {
    const context = this.context;
    const active = this.active;
    if (!context || !active) return undefined;

    const videos = [...this.videos];
    this.context = undefined;
    this.active = undefined;
    this.videos = [];
    await context.close();

    for (const video of videos) {
      const path = await video.path().catch(() => undefined);
      if (path && existsSync(path)) {
        return relative(active.session_directory, path);
      }
    }
    return undefined;
  }

  private trackPage(page: Page): void {
    const video = page.video();
    if (video && !this.videos.includes(video)) this.videos.push(video);
  }
}

function recorderInitScript(): string {
  return String.raw`
(() => {
  if (window.__trailwiseBrowserCaptureInstalled) return;
  window.__trailwiseBrowserCaptureInstalled = true;
  const SENSITIVE_PATTERN = /password|passwd|token|secret|api[_-]?key|credit|card|otp|ssn|security\s*code|cvv/i;
  let lastNavigationUrl = location.href;

  const cssEscape = (value) => {
    if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(value);
    return String(value).replace(/["\\]/g, "\\$&");
  };

  const attrSelector = (name, value) => "[" + name + "=\"" + cssEscape(value) + "\"]";

  const selectorFor = (el) => {
    if (!el || !el.getAttribute || !el.tagName) return null;
    const testId = el.getAttribute("data-testid");
    if (testId) return attrSelector("data-testid", testId);
    const dataId = el.getAttribute("data-id");
    if (dataId) return attrSelector("data-id", dataId);
    if (el.id && !SENSITIVE_PATTERN.test(el.id)) return "#" + cssEscape(el.id);
    const aria = el.getAttribute("aria-label");
    if (aria) return attrSelector("aria-label", aria);
    const name = el.getAttribute("name");
    if (name) return el.tagName.toLowerCase() + attrSelector("name", name);
    const placeholder = el.getAttribute("placeholder");
    if (placeholder) return el.tagName.toLowerCase() + attrSelector("placeholder", placeholder);
    return el.tagName.toLowerCase();
  };

  const interactiveTargetFor = (el) => {
    if (!el || !el.closest) return el;
    return el.closest("button,a[href],input,textarea,select,summary,[role],[data-testid],[data-id],[onclick],[tabindex]") || el;
  };

  const implicitRoleFor = (el) => {
    const tag = el && el.tagName ? el.tagName.toLowerCase() : "";
    if (tag === "button") return "button";
    if (tag === "a" && el.getAttribute("href")) return "link";
    if (tag === "input") {
      const type = (el.getAttribute("type") || "text").toLowerCase();
      if (["button", "submit", "reset"].includes(type)) return "button";
      if (type === "checkbox") return "checkbox";
      if (type === "radio") return "radio";
      return "textbox";
    }
    if (tag === "textarea") return "textbox";
    if (tag === "select") return "combobox";
    return null;
  };

  const textFor = (el) => {
    const value = (el && (el.innerText || el.textContent) || "").replace(/\s+/g, " ").trim();
    return value ? value.slice(0, 200) : null;
  };

  const labelFor = (el) => {
    if (!el || !document) return null;
    if (el.id) {
      const label = document.querySelector("label[for=\"" + cssEscape(el.id) + "\"]");
      if (label && label.textContent) return label.textContent.trim().slice(0, 120);
    }
    const wrappingLabel = el.closest ? el.closest("label") : null;
    if (wrappingLabel && wrappingLabel.textContent) return wrappingLabel.textContent.trim().slice(0, 120);
    return el.getAttribute && (el.getAttribute("aria-label") || el.getAttribute("placeholder")) || null;
  };

  const rectFor = (el) => {
    if (!el || typeof el.getBoundingClientRect !== "function") return null;
    const rect = el.getBoundingClientRect();
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left
    };
  };

  const describeElement = (el) => {
    if (!el || !el.getAttribute || !el.tagName) return null;
    return {
      tag: el.tagName.toLowerCase(),
      selector: selectorFor(el),
      text: textFor(el),
      ariaLabel: el.getAttribute("aria-label"),
      role: el.getAttribute("role") || implicitRoleFor(el),
      type: el.getAttribute("type"),
      name: el.getAttribute("name"),
      id: el.id || null,
      placeholder: el.getAttribute("placeholder"),
      label: labelFor(el),
      boundingClientRect: rectFor(el)
    };
  };

  const isSensitiveElement = (el) => {
    if (!el || !el.getAttribute) return false;
    const type = el.getAttribute("type") || "";
    if (type.toLowerCase() === "hidden" || type.toLowerCase() === "password") return true;
    return SENSITIVE_PATTERN.test([
      type,
      el.getAttribute("name"),
      el.id,
      el.getAttribute("placeholder"),
      el.getAttribute("aria-label"),
      el.getAttribute("autocomplete"),
      labelFor(el)
    ].filter(Boolean).join(" "));
  };

  const normalizeInputValue = (el) => {
    if (isSensitiveElement(el)) return { value_policy: "redacted", value: "[REDACTED]" };
    return { value_policy: "typed_text_placeholder", value: "[TYPED_TEXT]" };
  };

  const sendEvent = (event) => {
    if (typeof window.trailwiseRecordEvent !== "function") return;
    void window.trailwiseRecordEvent({
      ts: Date.now(),
      url: location.href,
      title: document.title,
      ...event
    });
  };

  const sendNavigationIfChanged = (reason) => {
    if (location.href === lastNavigationUrl && reason !== "load") return;
    lastNavigationUrl = location.href;
    sendEvent({ type: "navigation", text: reason });
  };

  document.addEventListener("click", (event) => {
    const element = describeElement(interactiveTargetFor(event.target));
    sendEvent({
      type: "click",
      selector: element && element.selector || null,
      role: element && element.role || null,
      label: element && (element.label || element.ariaLabel) || null,
      text: element && (element.text || element.ariaLabel || element.label) || null,
      element
    });
  }, true);

  document.addEventListener("input", (event) => {
    const target = interactiveTargetFor(event.target);
    const element = describeElement(target);
    sendEvent({
      type: "input",
      selector: element && element.selector || null,
      role: element && element.role || null,
      label: element && (element.label || element.ariaLabel) || null,
      element,
      ...normalizeInputValue(target)
    });
  }, true);

  for (const method of ["pushState", "replaceState"]) {
    const original = history[method];
    history[method] = function trailwiseHistoryWrapper(...args) {
      const result = original.apply(this, args);
      setTimeout(() => sendNavigationIfChanged(method), 0);
      return result;
    };
  }

  window.addEventListener("popstate", () => setTimeout(() => sendNavigationIfChanged("popstate"), 0));
  window.addEventListener("hashchange", () => setTimeout(() => sendNavigationIfChanged("hashchange"), 0));
  sendNavigationIfChanged("load");
})();
`;
}
