// Tabs, hash routing, keyboard steps and the footer build stamp. Each tab
// (RegTab, StepTab) owns its own state and DOM.

(function () {
  const TABS = { reg: RegTab, step: StepTab };
  const HASH = { reg: "#regression", step: "#stepsize" };
  let mode = "reg";

  function setMode(m) {
    TABS[mode].stop();
    mode = m;
    history.replaceState(null, "", HASH[m]);
    for (const t of document.querySelectorAll(".tab")) {
      t.setAttribute("aria-selected", t.dataset.mode === m);
    }
    for (const el of document.querySelectorAll("[data-show]")) {
      el.hidden = el.dataset.show !== m;
    }
    TABS[m].render();
  }

  for (const t of document.querySelectorAll(".tab")) {
    t.onclick = () => { if (t.dataset.mode !== mode) setMode(t.dataset.mode); };
  }

  document.addEventListener("keydown", e => {
    if (e.target.tagName === "INPUT" || e.metaKey || e.ctrlKey) return;
    if (e.key === " " || e.key === "ArrowRight") {
      e.preventDefault();
      TABS[mode].step();
    }
  });

  // Footer build stamp: the deployed commit (linked) and build time.
  const el = document.getElementById("build");
  const repo = "https://github.com/matthigger/gradient_descent";
  if (!BUILD) {
    el.textContent = "local copy";
  } else {
    const when = new Date(BUILD.time).toLocaleString("en-US", {
      dateStyle: "medium", timeStyle: "short" });
    el.innerHTML = `build <a href="${repo}/commit/${BUILD.sha}">${
      BUILD.sha.slice(0, 7)}</a>, ${when}`;
  }

  setMode(location.hash === "#stepsize" ? "step" : "reg");
})();
