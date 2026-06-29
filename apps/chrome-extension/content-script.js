(function startTrailwiseContentRecorder() {
  const utils = globalThis.TrailwiseRecorder;
  if (!utils) return;

  let lastNavigationUrl = location.href;

  function sendEvent(event) {
    chrome.runtime.sendMessage({
      kind: "record_event",
      event: {
        ts: Date.now(),
        url: location.href,
        title: document.title,
        ...event
      }
    });
  }

  function sendNavigationIfChanged(reason) {
    if (location.href === lastNavigationUrl && reason !== "load") return;
    lastNavigationUrl = location.href;
    sendEvent({
      type: "navigation",
      text: reason
    });
  }

  document.addEventListener(
    "click",
    (event) => {
      const element = utils.describeElement(event.target);
      sendEvent({
        type: "click",
        selector: element?.selector || null,
        role: element?.role || null,
        label: element?.label || element?.ariaLabel || null,
        text: element?.text || element?.ariaLabel || element?.label || null,
        element
      });
    },
    true
  );

  document.addEventListener(
    "input",
    (event) => {
      const element = utils.describeElement(event.target);
      const value = utils.normalizeInputValue(event.target);
      sendEvent({
        type: "input",
        selector: element?.selector || null,
        role: element?.role || null,
        label: element?.label || element?.ariaLabel || null,
        element,
        ...value
      });
    },
    true
  );

  document.addEventListener(
    "submit",
    (event) => {
      const element = utils.describeElement(event.target);
      sendEvent({
        type: "submit",
        selector: element?.selector || null,
        text: element?.text || null,
        element
      });
    },
    true
  );

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
