/* Moses Alabi — scheduling & personal time manager (static, browser-based) */
(function () {
  "use strict";
  var KEY = "ma_schedule_v1";
  var TZ = "Africa/Lagos";
  var DEFAULT = {
    settings: {
      workStart: 9, workEnd: 17, days: [1, 2, 3, 4, 5], durations: [30, 60], buffer: 15, ahead: 60,
      zoom: "", address: "", proxy: "", passHash: "",
      notify: ["mossalab@gmail.com", "malalabi@outlook.com", "fshmentorship@outlook.com", "malabi@iom.int"]
    },
    feeds: [
      { label: "Google", email: "mossalab@gmail.com", url: "", events: [], synced: "" },
      { label: "Outlook", email: "malalabi@outlook.com", url: "", events: [], synced: "" },
      { label: "Outlook", email: "fshmentorship@outlook.com", url: "", events: [], synced: "" },
      { label: "Outlook (IOM)", email: "malabi@iom.int", url: "", events: [], synced: "" }
    ],
    bookings: [], personal: []
  };

  function load() {
    try { var d = JSON.parse(localStorage.getItem(KEY)); if (d && d.settings) return merge(d); } catch (e) {}
    return JSON.parse(JSON.stringify(DEFAULT));
  }
  function merge(d) {
    var base = JSON.parse(JSON.stringify(DEFAULT));
    base.settings = Object.assign(base.settings, d.settings || {});
    ["feeds", "bookings", "personal"].forEach(function (k) { if (Array.isArray(d[k])) base[k] = d[k]; });
    return base;
  }
  function save() { localStorage.setItem(KEY, JSON.stringify(S)); }
  var S = load();
  var $ = function (id) { return document.getElementById(id); };
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  /* ---------- Time zone helpers (Lagos wall-clock <-> UTC) ---------- */
  function tzOffsetMin(date, tz) {
    var p = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(date);
    var o = {}; p.forEach(function (x) { o[x.type] = x.value; });
    return (Date.UTC(+o.year, o.month - 1, +o.day, +o.hour % 24, +o.minute, +o.second) - date.getTime()) / 60000;
  }
  function wall(y, m, d, h, mi, tz) {
    var guess = Date.UTC(y, m, d, h, mi);
    try { return new Date(guess - tzOffsetMin(new Date(guess), tz || TZ) * 60000); } catch (e) { return new Date(guess - 60 * 60000); }
  }
  function fmt(d, opts) { return new Intl.DateTimeFormat("en-GB", Object.assign({ timeZone: TZ }, opts)).format(d); }
  function fmtLocal(d) { return new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d); }
  function lagosParts(d) {
    var p = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "numeric", day: "numeric", weekday: "short" }).formatToParts(d);
    var o = {}; p.forEach(function (x) { o[x.type] = x.value; });
    return { y: +o.year, m: o.month - 1, d: +o.day, wd: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(o.weekday) };
  }

  /* ---------- ICS parsing ---------- */
  function parseIcsDate(val, params) {
    var m = val.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/);
    if (!m) return null;
    if (!m[4]) return { date: wall(+m[1], m[2] - 1, +m[3], 0, 0), allDay: true };
    if (m[7]) return { date: new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0))) };
    var tz = (params.match(/TZID=([^;:]+)/) || [])[1];
    var ok = true; try { new Intl.DateTimeFormat("en", { timeZone: tz }); } catch (e) { ok = false; }
    return { date: wall(+m[1], m[2] - 1, +m[3], +m[4], +m[5], tz && ok ? tz : TZ) };
  }
  function parseIcs(text, source) {
    var lines = text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/);
    var out = [], ev = null, horizon = Date.now() + 400 * 864e5, floor = Date.now() - 2 * 864e5;
    lines.forEach(function (ln) {
      if (ln === "BEGIN:VEVENT") { ev = {}; return; }
      if (ln === "END:VEVENT") {
        if (ev && ev.start && ev.status !== "CANCELLED" && ev.transp !== "TRANSPARENT") {
          var end = ev.end || new Date(ev.start.getTime() + (ev.allDay ? 864e5 : 36e5));
          var dur = end - ev.start, step = 0, count = Infinity, until = horizon, interval = 1;
          if (ev.rrule) {
            var f = (ev.rrule.match(/FREQ=(\w+)/) || [])[1];
            step = f === "DAILY" ? 864e5 : f === "WEEKLY" ? 7 * 864e5 : 0;
            interval = +((ev.rrule.match(/INTERVAL=(\d+)/) || [])[1] || 1);
            if (ev.rrule.match(/COUNT=(\d+)/)) count = +ev.rrule.match(/COUNT=(\d+)/)[1];
            var u = ev.rrule.match(/UNTIL=([0-9TZ]+)/); if (u) { var pu = parseIcsDate(u[1], ""); if (pu) until = Math.min(horizon, pu.date.getTime()); }
          }
          var t = ev.start.getTime(), n = 0;
          do {
            if (t + dur > floor && !(ev.exdates || []).some(function (x) { return Math.abs(x - t) < 6e4; }))
              out.push({ start: new Date(t).toISOString(), end: new Date(t + dur).toISOString(), title: "Busy", source: source });
            t += step * interval; n++;
          } while (step && n < count && t <= until && n < 800);
        }
        ev = null; return;
      }
      if (!ev) return;
      var i = ln.indexOf(":"); if (i < 0) return;
      var head = ln.slice(0, i), val = ln.slice(i + 1), name = head.split(";")[0];
      if (name === "DTSTART") { var p = parseIcsDate(val, head); if (p) { ev.start = p.date; ev.allDay = p.allDay; } }
      else if (name === "DTEND") { var q = parseIcsDate(val, head); if (q) ev.end = q.date; }
      else if (name === "RRULE") ev.rrule = val;
      else if (name === "EXDATE") ev.exdates = (ev.exdates || []).concat(val.split(",").map(function (v) { var x = parseIcsDate(v, head); return x ? x.date.getTime() : 0; }));
      else if (name === "STATUS") ev.status = val;
      else if (name === "TRANSP") ev.transp = val;
    });
    return out;
  }
  function fetchFeed(f) {
    var url = f.url.replace(/^webcal:/i, "https:");
    var tries = [url]; if (S.settings.proxy) tries.push(S.settings.proxy + encodeURIComponent(url));
    var attempt = function (i) {
      if (i >= tries.length) return Promise.reject(new Error("blocked"));
      return fetch(tries[i]).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
        .then(function (t) { if (t.indexOf("BEGIN:VCALENDAR") < 0) throw new Error("not a calendar"); return t; })
        .catch(function () { return attempt(i + 1); });
    };
    return attempt(0).then(function (t) { f.events = parseIcs(t, f.email); f.synced = new Date().toISOString(); });
  }
  function syncAll() {
    var jobs = S.feeds.filter(function (f) { return f.url; }).map(function (f) {
      return fetchFeed(f).then(function () { return f.email + ": " + f.events.length + " busy times"; }, function () { return f.email + ": couldn't open this link (using last saved copy)"; });
    });
    return Promise.all(jobs).then(function (r) { save(); return r; });
  }

  /* ---------- Busy times & clash check ---------- */
  function busyList() {
    var b = [];
    S.feeds.forEach(function (f) { (f.events || []).forEach(function (e) { b.push(e); }); });
    S.personal.forEach(function (p) { b.push(p); });
    S.bookings.forEach(function (k) { if (k.status !== "cancelled") b.push(k); });
    return b;
  }
  function clashes(start, end, ignoreId) {
    var pad = (S.settings.buffer || 0) * 6e4;
    return busyList().filter(function (e) {
      if (ignoreId && e.id === ignoreId) return false;
      return new Date(e.start).getTime() - pad < end.getTime() && new Date(e.end).getTime() + pad > start.getTime();
    });
  }
  function slotsFor(y, m, d, dur) {
    var out = [], st = S.settings, now = Date.now() + 2 * 36e5;
    for (var min = st.workStart * 60; min + dur <= st.workEnd * 60; min += 30) {
      var s = wall(y, m, d, Math.floor(min / 60), min % 60), e = new Date(s.getTime() + dur * 6e4);
      if (s.getTime() > now && !clashes(s, e).length) out.push(s);
    }
    return out;
  }

  /* ---------- Files ---------- */
  function icsStamp(d) { return new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); }
  function icsText(t) { return String(t || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, "\\$&"); }
  function buildIcs(items) {
    var L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Moses Alabi//Scheduling//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
    items.forEach(function (k) {
      L.push("BEGIN:VEVENT", "UID:" + (k.id || Math.random().toString(36).slice(2)) + "@mosesalabi", "DTSTAMP:" + icsStamp(Date.now()),
        "DTSTART:" + icsStamp(k.start), "DTEND:" + icsStamp(k.end), "SUMMARY:" + icsText(k.title),
        "DESCRIPTION:" + icsText(k.notes || ""), "LOCATION:" + icsText(k.location || ""), "END:VEVENT");
    });
    L.push("END:VCALENDAR");
    return L.join("\r\n");
  }
  function download(name, text, type) {
    var url = URL.createObjectURL(new Blob([text], { type: type }));
    var a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
  }
  function location(mode) { return mode === "online" ? (S.settings.zoom || "Zoom link will be sent by email") : (S.settings.address || "Venue will be confirmed by email"); }

  /* Visitor page loads the admin-published file (data/schedule.json) so everyone sees the same busy times */
  function loadPublished() {
    return fetch("data/schedule.json", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (pub) {
      if (!pub || !pub.settings) return;
      var mine = S.bookings.filter(function (b) { return b.local; });
      var keep = { settings: S.settings, feeds: S.feeds };
      S = merge(pub);
      if (!isAdminPage) { delete S.settings.passHash; }
      else { S.settings = Object.assign(S.settings, keep.settings); }
      mine.forEach(function (b) { if (!S.bookings.some(function (x) { return x.id === b.id; })) S.bookings.push(b); });
    }).catch(function () {});
  }

  /* ================= Visitor booking page ================= */
  var isAdminPage = !!$("adminApp");
  function initBooking() {
    var view = lagosParts(new Date()), sel = null, slot = null;
    view = { y: view.y, m: view.m };
    var dur = $("dur");
    dur.innerHTML = S.settings.durations.map(function (x) { return '<option value="' + x + '">' + x + " minutes</option>"; }).join("");
    function render() {
      var first = new Date(Date.UTC(view.y, view.m, 1)), days = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
      var today = lagosParts(new Date()), lim = Date.now() + S.settings.ahead * 864e5;
      var h = '<div class="hd"><button type="button" id="prev" aria-label="Previous month">‹</button><strong>' +
        fmt(new Date(Date.UTC(view.y, view.m, 15)), { month: "long", year: "numeric", timeZone: "UTC" }) +
        '</strong><button type="button" id="next" aria-label="Next month">›</button></div><div class="sch-grid">';
      ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach(function (n) { h += '<span class="dn">' + n + "</span>"; });
      for (var i = 0; i < first.getUTCDay(); i++) h += "<span></span>";
      for (var d = 1; d <= days; d++) {
        var wd = new Date(Date.UTC(view.y, view.m, d)).getUTCDay();
        var past = Date.UTC(view.y, view.m, d) < Date.UTC(today.y, today.m, today.d);
        var far = wall(view.y, view.m, d, 0, 0).getTime() > lim;
        var ok = !past && !far && S.settings.days.indexOf(wd) >= 0;
        var has = ok && slotsFor(view.y, view.m, d, +dur.value).length > 0;
        var isSel = sel && sel.y === view.y && sel.m === view.m && sel.d === d;
        h += '<button type="button" data-d="' + d + '" class="' + (has ? "has " : "") + (isSel ? "sel" : "") + '"' + (has ? "" : " disabled") + ">" + d + "</button>";
      }
      $("cal").innerHTML = h + "</div>";
      $("prev").onclick = function () { view.m--; if (view.m < 0) { view.m = 11; view.y--; } render(); };
      $("next").onclick = function () { view.m++; if (view.m > 11) { view.m = 0; view.y++; } render(); };
      $("cal").querySelectorAll("[data-d]").forEach(function (b) { b.onclick = function () { sel = { y: view.y, m: view.m, d: +b.dataset.d }; slot = null; render(); renderSlots(); }; });
    }
    function renderSlots() {
      if (!sel) return;
      var list = slotsFor(sel.y, sel.m, sel.d, +dur.value);
      $("chosenDay").textContent = fmt(wall(sel.y, sel.m, sel.d, 12, 0), { weekday: "long", day: "numeric", month: "long" }) + " — times shown in Lagos time";
      $("slots").innerHTML = list.length ? list.map(function (s) {
        return '<button type="button" data-t="' + s.toISOString() + '" class="' + (slot && slot.getTime() === s.getTime() ? "sel" : "") + '" title="Your time: ' + esc(fmtLocal(s)) + '">' + fmt(s, { hour: "2-digit", minute: "2-digit" }) + "</button>";
      }).join("") : '<span class="muted small">No free times left on this day.</span>';
      $("slots").querySelectorAll("[data-t]").forEach(function (b) { b.onclick = function () { slot = new Date(b.dataset.t); renderSlots(); }; });
    }
    dur.onchange = function () { slot = null; render(); renderSlots(); };
    $("bookForm").onsubmit = function (e) {
      e.preventDefault();
      var msg = $("bMsg");
      if (!slot) { msg.textContent = "Please choose a day and a time first."; return; }
      var end = new Date(slot.getTime() + dur.value * 6e4);
      if (clashes(slot, end).length) { msg.textContent = "Sorry, that time was just taken. Please pick another."; slot = null; render(); renderSlots(); return; }
      var mode = $("mode").value, name = $("bName").value.trim(), email = $("bEmail").value.trim(), topic = $("bTopic").value.trim();
      var k = { id: "bk" + Date.now().toString(36), start: slot.toISOString(), end: end.toISOString(), mode: mode, name: name, email: email, topic: topic,
        title: "Meeting: " + name + " & Moses Alabi (" + (mode === "online" ? "Zoom" : "In person") + ")", location: location(mode),
        notes: "Topic: " + topic + "\nGuest: " + name + " <" + email + ">", status: "requested", local: true, created: new Date().toISOString() };
      S.bookings.push(k); save();
      download("meeting-with-moses-alabi.ics", buildIcs([k]), "text/calendar");
      var body = "New meeting request\n\nName: " + name + "\nEmail: " + email + "\nWhen (Lagos): " + fmt(slot, { dateStyle: "full", timeStyle: "short" }) +
        "\nLength: " + dur.value + " min\nFormat: " + (mode === "online" ? "Online (Zoom)" : "In person") + "\nLocation: " + k.location + "\nTopic: " + topic;
      window.location.href = "mailto:" + S.settings.notify.join(",") + "?subject=" + encodeURIComponent("Meeting request — " + name) + "&body=" + encodeURIComponent(body);
      msg.textContent = "Done! A calendar invite was downloaded and your email app opened to send the request to Moses.";
      slot = null; e.target.reset(); render(); renderSlots();
    };
    var synced = S.feeds.filter(function (f) { return f.synced; }).length;
    $("syncNote").textContent = synced ? "Busy times checked against " + synced + " of Moses's calendars." : "Can't see a time that works? Email mossalab@gmail.com.";
    render();
  }

  /* ================= Admin page ================= */
  function hash(t) {
    if (window.crypto && crypto.subtle) return crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)).then(function (b) { return Array.from(new Uint8Array(b)).map(function (x) { return x.toString(16).padStart(2, "0"); }).join(""); });
    return Promise.resolve(btoa(t));
  }
  function toLocalInput(iso) { var d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); }
  function initAdmin() {
    $("lockHint").textContent = S.settings.passHash ? "Enter your admin passcode." : "First visit: choose a passcode to protect this page on this device.";
    $("passBtn").onclick = function () {
      var p = $("pass").value; if (!p) return;
      hash(p).then(function (h) {
        if (!S.settings.passHash) { S.settings.passHash = h; save(); }
        if (h !== S.settings.passHash) { $("lockHint").textContent = "Wrong passcode."; return; }
        $("lock").hidden = true; $("adm").hidden = false; fill();
      });
    };
    $("pass").onkeydown = function (e) { if (e.key === "Enter") $("passBtn").click(); };
  }
  function fill() {
    var st = S.settings;
    $("wStart").value = st.workStart; $("wEnd").value = st.workEnd; $("wDays").value = st.days.join(","); $("durs").value = st.durations.join(",");
    $("buffer").value = st.buffer; $("ahead").value = st.ahead; $("zoom").value = st.zoom; $("addr").value = st.address; $("proxy").value = st.proxy || "";
    renderFeeds(); renderList();
    $("saveSet").onclick = function () {
      var nums = function (v) { return v.split(",").map(function (x) { return parseInt(x, 10); }).filter(function (x) { return !isNaN(x); }); };
      st.workStart = +$("wStart").value; st.workEnd = +$("wEnd").value; st.days = nums($("wDays").value); st.durations = nums($("durs").value).filter(function (x) { return x > 0; });
      st.buffer = +$("buffer").value || 0; st.ahead = +$("ahead").value || 60; st.zoom = $("zoom").value.trim(); st.address = $("addr").value.trim(); st.proxy = $("proxy").value.trim();
      var np = $("newPass").value;
      (np ? hash(np).then(function (h) { st.passHash = h; }) : Promise.resolve()).then(function () { save(); $("newPass").value = ""; alert("Settings saved."); });
    };
    $("syncBtn").onclick = function () { S.settings.proxy = $("proxy").value.trim(); $("syncMsg").textContent = "Refreshing…"; syncAll().then(function (r) { $("syncMsg").textContent = r.join(" · ") || "Add a calendar link first."; renderFeeds(); renderList(); }); };
    $("addP").onclick = function () {
      var s = new Date($("pStart").value), e = new Date($("pEnd").value);
      if (isNaN(s) || isNaN(e) || e <= s) { $("pMsg").textContent = "Pick a valid start and end."; return; }
      var c = clashes(s, e);
      if (c.length && !confirm("This overlaps " + c.length + " item(s) already on your schedule. Block anyway?")) return;
      S.personal.push({ id: "pt" + Date.now().toString(36), start: s.toISOString(), end: e.toISOString(), title: $("pTitle").value.trim() || "Personal time", type: "personal" });
      save(); $("pMsg").textContent = "Time blocked."; renderList();
    };
    $("dlIcs").onclick = function () { download("moses-alabi-schedule.ics", buildIcs(S.bookings.filter(function (b) { return b.status !== "cancelled"; }).concat(S.personal)), "text/calendar"); };
    $("dlCsv").onclick = function () {
      var rows = [["Type", "Title", "Start (Lagos)", "End (Lagos)", "Format", "Guest", "Email", "Status", "Topic"]];
      allItems().forEach(function (i) { rows.push([i.kind, i.title, fmt(new Date(i.start), { dateStyle: "medium", timeStyle: "short" }), fmt(new Date(i.end), { dateStyle: "medium", timeStyle: "short" }), i.mode || "", i.name || "", i.email || "", i.status || "", i.topic || ""]); });
      download("moses-alabi-schedule.csv", rows.map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(","); }).join("\n"), "text/csv;charset=utf-8");
    };
    $("dlAdmin").onclick = function () {
      var out = JSON.parse(JSON.stringify(S)); out.exported = new Date().toISOString();
      out.bookings.forEach(function (b) { delete b.local; });
      download("schedule.json", JSON.stringify(out, null, 2), "application/json");
    };
    $("upAdmin").onchange = function (e) {
      var f = e.target.files[0]; if (!f) return;
      f.text().then(function (t) { var d = JSON.parse(t); if (!d.settings) throw 0; var ph = S.settings.passHash; S = merge(d); S.settings.passHash = d.settings.passHash || ph; save(); fill(); alert("Admin file loaded."); })
        .catch(function () { alert("That file isn't a valid admin file."); });
    };
  }
  function renderFeeds() {
    $("feeds").innerHTML = S.feeds.map(function (f, i) {
      return '<div class="sch-feed"><strong>' + esc(f.label) + "</strong> <span class=\"muted small\">" + esc(f.email) + "</span>" +
        '<label>Calendar link (.ics) <input data-fu="' + i + '" value="' + esc(f.url) + '" placeholder="https://…/basic.ics"></label>' +
        '<label class="small">…or upload an exported .ics file <input type="file" accept=".ics,text/calendar" data-ff="' + i + '"></label>' +
        '<p class="muted small">' + (f.synced ? (f.events || []).length + " busy times · updated " + fmtLocal(new Date(f.synced)) : "Not connected yet") + "</p></div>";
    }).join("") + '<button class="btn" type="button" id="addFeed">+ Add another calendar</button>';
    $("feeds").querySelectorAll("[data-fu]").forEach(function (inp) { inp.onchange = function () { S.feeds[+inp.dataset.fu].url = inp.value.trim(); save(); }; });
    $("feeds").querySelectorAll("[data-ff]").forEach(function (inp) {
      inp.onchange = function () { var f = inp.files[0], feed = S.feeds[+inp.dataset.ff]; if (!f) return; f.text().then(function (t) { feed.events = parseIcs(t, feed.email); feed.synced = new Date().toISOString(); save(); renderFeeds(); renderList(); }); };
    });
    $("addFeed").onclick = function () { var em = prompt("Calendar email or name?"); if (em) { S.feeds.push({ label: "Calendar", email: em, url: "", events: [], synced: "" }); save(); renderFeeds(); } };
  }
  function allItems() {
    var a = [];
    S.bookings.forEach(function (b) { a.push(Object.assign({ kind: "Meeting" }, b)); });
    S.personal.forEach(function (p) { a.push(Object.assign({ kind: "Personal" }, p)); });
    S.feeds.forEach(function (f) { (f.events || []).forEach(function (e) { a.push(Object.assign({ kind: "Calendar", status: f.email }, e)); }); });
    return a.filter(function (i) { return new Date(i.end) > Date.now() - 864e5; }).sort(function (x, y) { return new Date(x.start) - new Date(y.start); });
  }
  function renderList() {
    var items = allItems();
    $("list").innerHTML = items.length ? items.slice(0, 300).map(function (i) {
      var edit = i.kind !== "Calendar" ? '<button data-ed="' + i.id + '">Edit</button>' + (i.kind === "Meeting" && i.status !== "confirmed" ? '<button data-ok="' + i.id + '">Confirm</button>' : "") +
        (i.kind === "Meeting" && i.status !== "cancelled" ? '<button data-cx="' + i.id + '">Cancel</button>' : "") + '<button data-rm="' + i.id + '">Delete</button>' : "";
      return '<div class="sch-row"><div><span class="tag">' + i.kind + (i.status ? " · " + esc(i.status) : "") + "</span><br>" + esc(i.title) +
        (i.email ? ' <span class="muted small">(' + esc(i.email) + ")</span>" : "") + '<br><span class="muted small mono">' +
        fmt(new Date(i.start), { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) + " – " + fmt(new Date(i.end), { hour: "2-digit", minute: "2-digit" }) + "</span></div><div>" + edit + "</div></div>";
    }).join("") : '<p class="muted small">Nothing scheduled yet.</p>';
    function find(id) { return S.bookings.find(function (b) { return b.id === id; }) || S.personal.find(function (p) { return p.id === id; }); }
    $("list").querySelectorAll("[data-ok]").forEach(function (b) { b.onclick = function () { find(b.dataset.ok).status = "confirmed"; save(); renderList(); }; });
    $("list").querySelectorAll("[data-cx]").forEach(function (b) { b.onclick = function () { find(b.dataset.cx).status = "cancelled"; save(); renderList(); }; });
    $("list").querySelectorAll("[data-rm]").forEach(function (b) { b.onclick = function () { if (!confirm("Delete this item?")) return; var id = b.dataset.rm; S.bookings = S.bookings.filter(function (x) { return x.id !== id; }); S.personal = S.personal.filter(function (x) { return x.id !== id; }); save(); renderList(); }; });
    $("list").querySelectorAll("[data-ed]").forEach(function (b) {
      b.onclick = function () {
        var it = find(b.dataset.ed);
        var title = prompt("Title", it.title); if (title === null) return;
        var s = prompt("Start (YYYY-MM-DDTHH:MM, your time)", toLocalInput(it.start)); if (s === null) return;
        var e = prompt("End (YYYY-MM-DDTHH:MM, your time)", toLocalInput(it.end)); if (e === null) return;
        var sd = new Date(s), ed = new Date(e);
        if (isNaN(sd) || isNaN(ed) || ed <= sd) { alert("Invalid times."); return; }
        if (clashes(sd, ed, it.id).length && !confirm("This new time clashes with something else. Save anyway?")) return;
        it.title = title; it.start = sd.toISOString(); it.end = ed.toISOString(); save(); renderList();
      };
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    loadPublished().then(function () {
      if (isAdminPage) initAdmin(); else if ($("bookForm")) initBooking();
    });
  });
})();
