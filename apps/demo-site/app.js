function show(step) {
  for (const panel of document.querySelectorAll("[data-step]")) {
    panel.classList.toggle("hidden", panel.dataset.step !== step);
  }
  history.pushState({ step }, "", `#${step}`);
}

document.querySelector("#createAccount").addEventListener("click", () => show("account"));

document.querySelector("#accountForm").addEventListener("submit", (event) => {
  event.preventDefault();
  show("plan");
});

document.querySelector("[data-testid='plan-starter']").addEventListener("click", () => show("dashboard"));
document.querySelector("[data-testid='plan-team']").addEventListener("click", () => show("dashboard"));

if (location.hash === "#dashboard") show("dashboard");
