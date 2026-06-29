(function attachRecorderUtils(global) {
  const SENSITIVE_PATTERN = /password|passwd|token|secret|api[_-]?key|credit|card|otp|ssn|security\s*code|cvv/i;

  function cssEscape(value) {
    if (global.CSS && typeof global.CSS.escape === "function") {
      return global.CSS.escape(value);
    }
    return String(value).replace(/["\\]/g, "\\$&");
  }

  function attrSelector(name, value) {
    return `[${name}="${cssEscape(value)}"]`;
  }

  function selectorFor(el) {
    if (!el || !el.getAttribute || !el.tagName) return null;

    const testId = el.getAttribute("data-testid");
    if (testId) return attrSelector("data-testid", testId);

    if (el.id && !SENSITIVE_PATTERN.test(el.id)) return `#${cssEscape(el.id)}`;

    const aria = el.getAttribute("aria-label");
    if (aria) return attrSelector("aria-label", aria);

    const name = el.getAttribute("name");
    if (name) return `${el.tagName.toLowerCase()}${attrSelector("name", name)}`;

    const placeholder = el.getAttribute("placeholder");
    if (placeholder) return `${el.tagName.toLowerCase()}${attrSelector("placeholder", placeholder)}`;

    return el.tagName.toLowerCase();
  }

  function labelFor(el) {
    if (!el || !global.document) return null;
    if (el.id) {
      const label = global.document.querySelector(`label[for="${cssEscape(el.id)}"]`);
      if (label && label.textContent) return label.textContent.trim().slice(0, 120);
    }
    const wrappingLabel = el.closest ? el.closest("label") : null;
    if (wrappingLabel && wrappingLabel.textContent) return wrappingLabel.textContent.trim().slice(0, 120);
    return el.getAttribute?.("aria-label") || el.getAttribute?.("placeholder") || null;
  }

  function rectFor(el) {
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
  }

  function describeElement(el) {
    if (!el || !el.getAttribute || !el.tagName) return null;
    return {
      tag: el.tagName.toLowerCase(),
      selector: selectorFor(el),
      text: textFor(el),
      ariaLabel: el.getAttribute("aria-label"),
      role: el.getAttribute("role"),
      type: el.getAttribute("type"),
      name: el.getAttribute("name"),
      id: el.id || null,
      placeholder: el.getAttribute("placeholder"),
      label: labelFor(el),
      boundingClientRect: rectFor(el)
    };
  }

  function textFor(el) {
    if (!el) return null;
    const value = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
    return value ? value.slice(0, 200) : null;
  }

  function isSensitiveElement(el) {
    if (!el || !el.getAttribute) return false;
    const type = el.getAttribute("type") || "";
    if (type.toLowerCase() === "hidden") return true;
    if (type.toLowerCase() === "password") return true;
    const joined = [
      type,
      el.getAttribute("name"),
      el.id,
      el.getAttribute("placeholder"),
      el.getAttribute("aria-label"),
      el.getAttribute("autocomplete"),
      labelFor(el)
    ]
      .filter(Boolean)
      .join(" ");
    return SENSITIVE_PATTERN.test(joined);
  }

  function normalizeInputValue(el) {
    if (isSensitiveElement(el)) {
      return { value_policy: "redacted", value: "[REDACTED]" };
    }
    return { value_policy: "typed_text_placeholder", value: "[TYPED_TEXT]" };
  }

  global.TrailwiseRecorder = {
    SENSITIVE_PATTERN,
    selectorFor,
    describeElement,
    isSensitiveElement,
    normalizeInputValue
  };
})(globalThis);
