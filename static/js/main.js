// Moses Alabi — site interactions (no dependencies)
(function () {
  "use strict";

  // Mobile navigation
  const btn = document.getElementById("menuBtn");
  const nav = document.getElementById("nav");
  if (btn && nav) {
    btn.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      btn.setAttribute("aria-expanded", String(open));
      btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      btn.textContent = open ? "✕" : "☰";
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && nav.classList.contains("open")) btn.click(); });
  }

  // Hero background rotation
  const hero = document.getElementById("hero");
  if (hero) {
    const slides = Array.from(hero.querySelectorAll(".slide"));
    const label = document.getElementById("bgLabel");
    const toggle = hero.querySelector('[data-bg="toggle"]');
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const interval = Math.max(3, Number(hero.dataset.interval) || 8) * 1000;
    let i = 0, timer = null;
    let playing = hero.dataset.rotate === "true" && !reduce && slides.length > 1;

    const show = (n) => {
      slides[i].classList.remove("on");
      i = (n + slides.length) % slides.length;
      slides[i].classList.add("on");
      if (label) label.textContent = slides[i].dataset.label || "";
    };
    const start = () => { stop(); if (playing) timer = setInterval(() => { if (!document.hidden) show(i + 1); }, interval); };
    const stop = () => { if (timer) clearInterval(timer); timer = null; };
    const syncToggle = () => {
      if (!toggle) return;
      toggle.textContent = playing ? "❚❚" : "▶";
      toggle.setAttribute("aria-label", playing ? "Pause background rotation" : "Resume background rotation");
    };

    hero.addEventListener("click", (e) => {
      const b = e.target.closest("[data-bg]");
      if (!b) return;
      if (b.dataset.bg === "next") { show(i + 1); start(); }
      if (b.dataset.bg === "prev") { show(i - 1); start(); }
      if (b.dataset.bg === "toggle") { playing = !playing; syncToggle(); start(); }
    });
    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
    syncToggle();
    start();
  }

  // Time-zone clocks
  const clocks = document.querySelectorAll("[data-tz]");
  if (clocks.length) {
    const tick = () => clocks.forEach((el) => {
      const tz = el.dataset.tz;
      const opts = { hour: "2-digit", minute: "2-digit" };
      if (tz !== "local") opts.timeZone = tz;
      el.textContent = new Date().toLocaleTimeString([], opts) +
        (tz === "local" ? " (" + Intl.DateTimeFormat().resolvedOptions().timeZone + ")" : "");
    });
    tick(); setInterval(tick, 30000);
  }

  // Admin helpers: confirm dialogs, range outputs, upload preview, unsaved-change warning
  document.querySelectorAll("form[data-confirm]").forEach((f) =>
    f.addEventListener("submit", (e) => { if (!confirm(f.dataset.confirm)) e.preventDefault(); }));

  document.querySelectorAll("input[type=range][data-out]").forEach((r) => {
    const out = document.getElementById(r.dataset.out);
    r.addEventListener("input", () => { if (out) out.textContent = r.value; });
  });

  document.querySelectorAll("input[type=file][data-preview]").forEach((inp) => {
    const img = document.getElementById(inp.dataset.preview);
    inp.addEventListener("change", () => {
      const f = inp.files && inp.files[0];
      if (!f || !img) return;
      if (f.size > 5 * 1024 * 1024) { alert("File is larger than 5 MB."); inp.value = ""; img.hidden = true; return; }
      img.src = URL.createObjectURL(f); img.hidden = false;
    });
  });

  let dirty = false;
  document.querySelectorAll("form[data-dirty]").forEach((f) => {
    f.addEventListener("input", () => { dirty = true; });
    f.addEventListener("submit", (e) => {
      const ta = f.querySelector("textarea");
      try { JSON.parse(ta.value); dirty = false; }
      catch (err) { e.preventDefault(); alert("This section contains invalid JSON:\n" + err.message); }
    });
  });
  window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });
})();
