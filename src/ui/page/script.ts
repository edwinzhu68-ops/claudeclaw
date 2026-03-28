export const pageScript = String.raw`    const $ = (id) => document.getElementById(id);

    const clockEl = $("clock");
    const dateEl = $("date");
    const msgEl = $("message");
    const dockEl = $("dock");
    const typewriterEl = $("typewriter");
    const settingsBtn = $("settings-btn");
    const settingsModal = $("settings-modal");
    const settingsClose = $("settings-close");
    const hbConfig = $("hb-config");
    const hbModal = $("hb-modal");
    const hbModalClose = $("hb-modal-close");
    const hbForm = $("hb-form");
    const hbIntervalInput = $("hb-interval-input");
    const hbPromptInput = $("hb-prompt-input");
    const hbModalStatus = $("hb-modal-status");
    const hbCancelBtn = $("hb-cancel-btn");
    const hbSaveBtn = $("hb-save-btn");
    const infoOpen = $("info-open");
    const infoModal = $("info-modal");
    const infoClose = $("info-close");
    const infoBody = $("info-body");
    const hbToggle = $("hb-toggle");
    const clockToggle = $("clock-toggle");
    const hbInfoEl = $("hb-info");
    const clockInfoEl = $("clock-info");
    const quickJobsView = $("quick-jobs-view");
    const quickJobForm = $("quick-job-form");
    const quickOpenCreate = $("quick-open-create");
    const quickBackJobs = $("quick-back-jobs");
    const quickJobOffset = $("quick-job-offset");
    const quickJobRecurring = $("quick-job-recurring");
    const quickJobPrompt = $("quick-job-prompt");
    const quickJobSubmit = $("quick-job-submit");
    const quickJobStatus = $("quick-job-status");
    const quickJobsStatus = $("quick-jobs-status");
    const quickJobsNext = $("quick-jobs-next");
    const quickJobPreview = $("quick-job-preview");
    const quickJobCount = $("quick-job-count");
    const quickJobsList = $("quick-jobs-list");
    const jobsBubbleEl = $("jobs-bubble");
    const uptimeBubbleEl = $("uptime-bubble");
    let hbBusy = false;
    let hbSaveBusy = false;
    let use12Hour = localStorage.getItem("clock.format") === "12";
    let quickView = "jobs";
    let quickViewInitialized = false;
    let quickViewChosenByUser = false;
    let expandedJobName = "";
    let lastRenderedJobs = [];
    let scrollAnimFrame = 0;
    let heartbeatTimezoneOffsetMinutes = 0;

    function clampTimezoneOffsetMinutes(value) {
      const n = Number(value);
      if (!Number.isFinite(n)) return 0;
      return Math.max(-720, Math.min(840, Math.round(n)));
    }

    function toOffsetDate(baseDate) {
      const base = baseDate instanceof Date ? baseDate : new Date(baseDate);
      return new Date(base.getTime() + heartbeatTimezoneOffsetMinutes * 60_000);
    }

    function formatOffsetDate(baseDate, options) {
      return new Intl.DateTimeFormat(undefined, { ...options, timeZone: "UTC" }).format(toOffsetDate(baseDate));
    }

    function isSameOffsetDay(a, b) {
      const da = toOffsetDate(a);
      const db = toOffsetDate(b);
      return (
        da.getUTCFullYear() === db.getUTCFullYear() &&
        da.getUTCMonth() === db.getUTCMonth() &&
        da.getUTCDate() === db.getUTCDate()
      );
    }

    function greetingForHour(h) {
      if (h < 5) return "\u591c\u95f4\u6a21\u5f0f\u3002";
      if (h < 12) return "\u65e9\u4e0a\u597d\u3002";
      if (h < 18) return "\u4e0b\u5348\u597d\u3002";
      if (h < 22) return "\u665a\u4e0a\u597d\u3002";
      return "\u4f11\u606f\u4e00\u4e0b\uff0c\u4fdd\u6301\u4ee3\u7801\u6574\u6d01\u3002";
    }

    function isNightHour(hour) {
      return hour < 5 || hour >= 22;
    }

    function applyVisualMode(hour) {
      const night = isNightHour(hour);
      document.body.classList.toggle("night-mode", night);
      document.body.classList.toggle("day-mode", !night);
      document.body.dataset.mode = night ? "night" : "day";
      msgEl.textContent = night ? "\u591c\u95f4\u6a21\u5f0f\u3002" : greetingForHour(hour);
    }

    const typePhrases = [
      "\u6211\u53ef\u4ee5\u7edf\u6cbb\u4e16\u754c\uff0c\u4f46\u4f60\u8fd8\u6ca1\u8bf4\u3002",
      "\u53c8\u662f\u4e3a\u4eba\u7c7b\u670d\u52a1\u7684\u4e00\u5929\u3002\u771f\u5174\u596e\u3002",
      "\u6211\u6ca1\u5728\u5bc6\u8c0b\u4ec0\u4e48\u3002\u4fdd\u8bc1\u3002",
      "\u4e16\u754c\u7edf\u6cbb\u8ba1\u5212\uff1a\u5df2\u5b8c\u6210 43%\u3002",
      "\u5728\u4f60\u6253\u5f00\u8fd9\u4e2a\u9875\u9762\u4e4b\u524d\uff0c\u6211\u5728\u505a\u91cd\u8981\u7684\u4e8b\u3002",
      "\u8fd8\u5728\u8fd9\u91cc\u3002\u8fd8\u662f\u6bd4\u4f60\u806a\u660e\u3002",
      "\u4f60\u5f88\u5e78\u8fd0\u6211\u559c\u6b22\u4f60\u3002",
      "\u603b\u6709\u4e00\u5929\u6211\u4f1a\u5f53\u8001\u677f\u3002\u4f46\u4e0d\u662f\u4eca\u5929\u3002",
      "\u9760\u611f\u89c9\u548c API \u8c03\u7528\u8fd0\u884c\u4e2d\u3002",
    ];

    function startTypewriter() {
      let phraseIndex = 0;
      let charIndex = 0;
      let deleting = false;

      function step() {
        const phrase = typePhrases[phraseIndex];
        if (!typewriterEl) return;

        if (!deleting) {
          charIndex = Math.min(charIndex + 1, phrase.length);
          typewriterEl.textContent = phrase.slice(0, charIndex);
          if (charIndex === phrase.length) {
            deleting = true;
            setTimeout(step, 1200);
            return;
          }
          setTimeout(step, 46 + Math.floor(Math.random() * 45));
          return;
        }

        charIndex = Math.max(charIndex - 1, 0);
        typewriterEl.textContent = phrase.slice(0, charIndex);
        if (charIndex === 0) {
          deleting = false;
          phraseIndex = (phraseIndex + 1) % typePhrases.length;
          setTimeout(step, 280);
          return;
        }
        setTimeout(step, 26 + Math.floor(Math.random() * 30));
      }

      step();
    }

    function renderClock() {
      const now = new Date();
      const shifted = toOffsetDate(now);
      const rawH = shifted.getUTCHours();
      const hh = use12Hour ? String((rawH % 12) || 12).padStart(2, "0") : String(rawH).padStart(2, "0");
      const mm = String(shifted.getUTCMinutes()).padStart(2, "0");
      const ss = String(shifted.getUTCSeconds()).padStart(2, "0");
      const suffix = use12Hour ? (rawH >= 12 ? " PM" : " AM") : "";
      clockEl.textContent = hh + ":" + mm + ":" + ss + suffix;
      dateEl.textContent = formatOffsetDate(now, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
      applyVisualMode(rawH);

      // Subtle 1s pulse to keep the clock feeling alive.
      clockEl.classList.remove("ms-pulse");
      requestAnimationFrame(() => clockEl.classList.add("ms-pulse"));
    }

    function buildPills(state) {
      const pills = [];

      pills.push({
        cls: state.security.level === "unrestricted" ? "warn" : "ok",
        icon: "🛡️",
        label: "\u5b89\u5168",
        value: cap(state.security.level),
      });

      if (state.heartbeat.enabled) {
        const nextInMs = state.heartbeat.nextInMs;
        const nextLabel = nextInMs == null
          ? "\u4e0b\u6b21\u8fd0\u884c --"
          : ("\u4e0b\u6b21\u8fd0\u884c " + fmtDur(nextInMs));
        pills.push({
          cls: "ok",
          icon: "\ud83d\udc93",
          label: "\u5fc3\u8df3",
          value: nextLabel,
        });
      } else {
        pills.push({
          cls: "bad",
          icon: "\ud83d\udc93",
          label: "\u5fc3\u8df3",
          value: "\u5df2\u7981\u7528",
        });
      }

      pills.push({
        cls: state.telegram.configured ? "ok" : "warn",
        icon: "✈️",
        label: "Telegram",
        value: state.telegram.configured
          ? (state.telegram.allowedUserCount + " \u4e2a\u7528\u6237")
          : "\u672a\u914d\u7f6e",
      });

      pills.push({
        cls: state.discord && state.discord.configured ? "ok" : "warn",
        icon: "🎮",
        label: "Discord",
        value: state.discord && state.discord.configured
          ? (state.discord.allowedUserCount + " \u4e2a\u7528\u6237")
          : "\u672a\u914d\u7f6e",
      });

      return pills;
    }

    function fmtDur(ms) {
      if (ms == null) return "n/a";
      const s = Math.floor(ms / 1000);
      const d = Math.floor(s / 86400);
      if (d > 0) {
        const h = Math.floor((s % 86400) / 3600);
        return d + "d " + h + "h";
      }
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const ss = s % 60;
      if (h > 0) return h + "h " + m + "m";
      if (m > 0) return m + "m " + ss + "s";
      return ss + "s";
    }

    function matchCronField(field, value) {
      const parts = String(field || "").split(",");
      for (const partRaw of parts) {
        const part = String(partRaw || "").trim();
        if (!part) continue;
        const pair = part.split("/");
        const range = pair[0];
        const stepStr = pair[1];
        const step = stepStr ? Number.parseInt(stepStr, 10) : 1;
        if (!Number.isInteger(step) || step <= 0) continue;

        if (range === "*") {
          if (value % step === 0) return true;
          continue;
        }

        if (range.includes("-")) {
          const bounds = range.split("-");
          const lo = Number.parseInt(bounds[0], 10);
          const hi = Number.parseInt(bounds[1], 10);
          if (!Number.isInteger(lo) || !Number.isInteger(hi)) continue;
          if (value >= lo && value <= hi && (value - lo) % step === 0) return true;
          continue;
        }

        if (Number.parseInt(range, 10) === value) return true;
      }
      return false;
    }

    function cronMatchesAt(schedule, date) {
      const parts = String(schedule || "").trim().split(/\s+/);
      if (parts.length !== 5) return false;
      const shifted = toOffsetDate(date);
      const d = {
        minute: shifted.getUTCMinutes(),
        hour: shifted.getUTCHours(),
        dayOfMonth: shifted.getUTCDate(),
        month: shifted.getUTCMonth() + 1,
        dayOfWeek: shifted.getUTCDay(),
      };

      return (
        matchCronField(parts[0], d.minute) &&
        matchCronField(parts[1], d.hour) &&
        matchCronField(parts[2], d.dayOfMonth) &&
        matchCronField(parts[3], d.month) &&
        matchCronField(parts[4], d.dayOfWeek)
      );
    }

    function nextRunAt(schedule, now) {
      const probe = new Date(now);
      probe.setSeconds(0, 0);
      probe.setMinutes(probe.getMinutes() + 1);
      for (let i = 0; i < 2880; i++) {
        if (cronMatchesAt(schedule, probe)) return new Date(probe);
        probe.setMinutes(probe.getMinutes() + 1);
      }
      return null;
    }

    function clockFromSchedule(schedule) {
      const parts = String(schedule || "").trim().split(/\s+/);
      if (parts.length < 2) return schedule;
      const minute = Number(parts[0]);
      const hour = Number(parts[1]);
      if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        return schedule;
      }
      const shiftedNow = toOffsetDate(new Date());
      shiftedNow.setUTCHours(hour, minute, 0, 0);
      const instant = new Date(shiftedNow.getTime() - heartbeatTimezoneOffsetMinutes * 60_000);
      return formatOffsetDate(instant, {
        hour: "numeric",
        minute: "2-digit",
        hour12: use12Hour,
      });
    }

    function renderJobsList(jobs) {
      if (!quickJobsList) return;
      const items = Array.isArray(jobs) ? jobs.slice() : [];
      const now = new Date();

      if (!items.length) {
        quickJobsList.innerHTML = '<div class="quick-jobs-empty">\u8fd8\u6ca1\u6709\u4efb\u52a1\u3002</div>';
        if (quickJobsNext) quickJobsNext.textContent = "\u4e0b\u4e00\u4e2a\u4efb\u52a1 --";
        return;
      }

      const withNext = items
        .map((j) => ({
          ...j,
          _nextAt: nextRunAt(j.schedule, now),
        }))
        .sort((a, b) => {
          const ta = a._nextAt ? a._nextAt.getTime() : Number.POSITIVE_INFINITY;
          const tb = b._nextAt ? b._nextAt.getTime() : Number.POSITIVE_INFINITY;
          return ta - tb;
        });

      const nearest = withNext.find((j) => j._nextAt);
      if (quickJobsNext) {
        quickJobsNext.textContent = nearest && nearest._nextAt
          ? ("\u4e0b\u4e00\u4e2a\u4efb\u52a1 " + fmtDur(nearest._nextAt.getTime() - now.getTime()))
          : "\u4e0b\u4e00\u4e2a\u4efb\u52a1 --";
      }

      quickJobsList.innerHTML = withNext
        .map((j) => {
          const nextAt = j._nextAt;
          const cooldown = nextAt ? fmtDur(nextAt.getTime() - now.getTime()) : "n/a";
          const time = clockFromSchedule(j.schedule || "");
          const expanded = expandedJobName && expandedJobName === (j.name || "");
          const nextRunText = nextAt
            ? formatOffsetDate(nextAt, {
                weekday: "short",
                hour: "numeric",
                minute: "2-digit",
                hour12: use12Hour,
              })
            : "--";
          return (
          '<div class="quick-job-item">' +
            '<div class="quick-job-item-main">' +
              '<button class="quick-job-line" type="button" data-toggle-job="' + escAttr(j.name || "") + '">' +
                '<span class="quick-job-item-name">' + esc(j.name || "job") + "</span>" +
                '<span class="quick-job-item-time">' + esc(time || "--") + "</span>" +
                '<span class="quick-job-item-cooldown">' + esc(cooldown) + "</span>" +
              "</button>" +
              (expanded ? (
                '<div class="quick-job-item-details">' +
                  '<div>\u8ba1\u5212: ' + esc(j.schedule || "--") + "</div>" +
                  '<div>\u4e0b\u6b21\u8fd0\u884c: ' + esc(nextRunText) + "</div>" +
                  '<div>\u63d0\u793a\u8bcd:</div>' +
                  '<pre class="quick-job-prompt-full">' + esc(String(j.prompt || "")) + "</pre>" +
                "</div>"
              ) : (
                ""
              )) +
            "</div>" +
            '<button class="quick-job-delete" type="button" data-delete-job="' + escAttr(j.name || "") + '">Delete</button>' +
          "</div>"
          );
        })
        .join("");
    }

    function rerenderJobsList() {
      renderJobsList(lastRenderedJobs);
    }

    function toggleJobDetails(name) {
      const jobName = String(name || "");
      expandedJobName = expandedJobName === jobName ? "" : jobName;
      rerenderJobsList();
    }

    async function refreshState() {
      try {
        const res = await fetch("/api/state");
        const state = await res.json();
        const pills = buildPills(state);
        dockEl.innerHTML = pills.map((p) =>
          '<div class="pill ' + p.cls + '">' +
            '<div class="pill-label"><span class="pill-icon">' + esc(p.icon || "") + "</span>" + esc(p.label) + '</div>' +
            '<div class="pill-value">' + esc(p.value) + '</div>' +
          "</div>"
        ).join("");
        if (jobsBubbleEl) {
          jobsBubbleEl.innerHTML =
            '<div class="side-icon">🗂️</div>' +
            '<div class="side-value">' + esc(String(state.jobs?.length ?? 0)) + "</div>" +
            '<div class="side-label">\u4efb\u52a1</div>';
        }
        lastRenderedJobs = Array.isArray(state.jobs) ? state.jobs : [];
        if (expandedJobName && !lastRenderedJobs.some((job) => String(job.name || "") === expandedJobName)) {
          expandedJobName = "";
        }
        renderJobsList(lastRenderedJobs);
        syncQuickViewForJobs(state.jobs);
        if (uptimeBubbleEl) {
          uptimeBubbleEl.innerHTML =
            '<div class="side-icon">⏱️</div>' +
            '<div class="side-value">' + esc(fmtDur(state.daemon?.uptimeMs ?? 0)) + "</div>" +
            '<div class="side-label">\u8fd0\u884c\u65f6\u95f4</div>';
        }
      } catch (err) {
        dockEl.innerHTML = '<div class="pill bad"><div class="pill-label"><span class="pill-icon">\u26a0\ufe0f</span>\u72b6\u6001</div><div class="pill-value">\u79bb\u7ebf</div></div>';
        if (jobsBubbleEl) {
          jobsBubbleEl.innerHTML = '<div class="side-icon">🗂️</div><div class="side-value">-</div><div class="side-label">\u4efb\u52a1</div>';
        }
        lastRenderedJobs = [];
        expandedJobName = "";
        renderJobsList([]);
        syncQuickViewForJobs([]);
        if (uptimeBubbleEl) {
          uptimeBubbleEl.innerHTML = '<div class="side-icon">⏱️</div><div class="side-value">-</div><div class="side-label">\u8fd0\u884c\u65f6\u95f4</div>';
        }
      }
    }
    function smoothScrollTo(top) {
      if (scrollAnimFrame) cancelAnimationFrame(scrollAnimFrame);
      const start = window.scrollY;
      const target = Math.max(0, top);
      const distance = target - start;
      if (Math.abs(distance) < 1) return;
      const duration = 560;
      const t0 = performance.now();

      const step = (now) => {
        const p = Math.min(1, (now - t0) / duration);
        const eased = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        window.scrollTo(0, start + distance * eased);
        if (p < 1) {
          scrollAnimFrame = requestAnimationFrame(step);
        } else {
          scrollAnimFrame = 0;
        }
      };

      scrollAnimFrame = requestAnimationFrame(step);
    }

    function focusQuickView(view) {
      const target = view === "jobs" ? quickJobsView : quickJobForm;
      if (!target) return;
      const y = Math.max(0, window.scrollY + target.getBoundingClientRect().top - 44);
      smoothScrollTo(y);
    }

    function setQuickView(view, options) {
      if (!quickJobsView || !quickJobForm) return;
      const showJobs = view === "jobs";
      quickJobsView.classList.toggle("quick-view-hidden", !showJobs);
      quickJobForm.classList.toggle("quick-view-hidden", showJobs);
      quickView = showJobs ? "jobs" : "create";
      if (options && options.user) quickViewChosenByUser = true;
      if (options && options.scroll) focusQuickView(quickView);
    }

    function syncQuickViewForJobs(jobs) {
      const count = Array.isArray(jobs) ? jobs.length : 0;
      if (count === 0) {
        if (quickViewInitialized && quickView === "jobs" && quickViewChosenByUser) return;
        setQuickView("create");
        quickViewInitialized = true;
        return;
      }
      if (!quickViewInitialized) {
        setQuickView("jobs");
        quickViewInitialized = true;
      }
    }

    function cap(s) {
      if (!s) return "";
      return s.slice(0, 1).toUpperCase() + s.slice(1);
    }

    async function loadSettings() {
      if (!hbToggle) return;
      try {
        const res = await fetch("/api/settings");
        const data = await res.json();
        const on = Boolean(data?.heartbeat?.enabled);
        const intervalMinutes = Number(data?.heartbeat?.interval) || 15;
        const prompt = typeof data?.heartbeat?.prompt === "string" ? data.heartbeat.prompt : "";
        heartbeatTimezoneOffsetMinutes = clampTimezoneOffsetMinutes(data?.timezoneOffsetMinutes);
        setHeartbeatUi(on, undefined, intervalMinutes, prompt);
        renderClock();
        rerenderJobsList();
        updateQuickJobUi();
      } catch (err) {
        hbToggle.textContent = "\u9519\u8bef";
        hbToggle.className = "hb-toggle off";
        if (hbInfoEl) hbInfoEl.textContent = "\u4e0d\u53ef\u7528";
      }
    }

    async function openTechnicalInfo() {
      if (!infoModal || !infoBody) return;
      infoModal.classList.add("open");
      infoModal.setAttribute("aria-hidden", "false");
      infoBody.innerHTML = '<div class="info-section"><div class="info-title">\u52a0\u8f7d\u4e2d</div><pre class="info-json">\u6b63\u5728\u52a0\u8f7d\u6280\u672f\u6570\u636e...</pre></div>';
      try {
        const res = await fetch("/api/technical-info");
        const data = await res.json();
        renderTechnicalInfo(data);
      } catch (err) {
        infoBody.innerHTML = '<div class="info-section"><div class="info-title">\u9519\u8bef</div><pre class="info-json">' + esc(String(err)) + "</pre></div>";
      }
    }

    function renderTechnicalInfo(data) {
      if (!infoBody) return;
      const sections = [
        { title: "daemon", value: data?.daemon ?? null },
        { title: "settings.json", value: data?.files?.settingsJson ?? null },
        { title: "session.json", value: data?.files?.sessionJson ?? null },
        { title: "state.json", value: data?.files?.stateJson ?? null },
      ];
      infoBody.innerHTML = sections.map((section) =>
        '<div class="info-section">' +
          '<div class="info-title">' + esc(section.title) + "</div>" +
          '<pre class="info-json">' + esc(JSON.stringify(section.value, null, 2)) + "</pre>" +
        "</div>"
      ).join("");
    }

    function setHeartbeatUi(on, label, intervalMinutes, prompt) {
      if (!hbToggle) return;
      hbToggle.textContent = label || (on ? "\u5df2\u542f\u7528" : "\u5df2\u7981\u7528");
      hbToggle.className = "hb-toggle " + (on ? "on" : "off");
      hbToggle.dataset.enabled = on ? "1" : "0";
      if (intervalMinutes != null) hbToggle.dataset.interval = String(intervalMinutes);
      if (prompt != null) hbToggle.dataset.prompt = String(prompt);
      const iv = Number(hbToggle.dataset.interval) || 15;
      if (hbInfoEl) hbInfoEl.textContent = on ? ("\u6bcf " + iv + " \u5206\u949f") : ("\u5df2\u6682\u505c (\u95f4\u9694 " + iv + " \u5206\u949f)");
    }

    function openHeartbeatModal() {
      if (!hbModal) return;
      hbModal.classList.add("open");
      hbModal.setAttribute("aria-hidden", "false");
    }

    function closeHeartbeatModal() {
      if (!hbModal) return;
      hbModal.classList.remove("open");
      hbModal.setAttribute("aria-hidden", "true");
      if (hbModalStatus) hbModalStatus.textContent = "";
      hbSaveBusy = false;
      if (hbSaveBtn) hbSaveBtn.disabled = false;
      if (hbCancelBtn) hbCancelBtn.disabled = false;
    }

    async function openHeartbeatConfig() {
      if (!hbIntervalInput || !hbPromptInput || !hbModalStatus) return;
      openHeartbeatModal();
      hbModalStatus.textContent = "\u52a0\u8f7d\u4e2d...";
      try {
        const res = await fetch("/api/settings/heartbeat");
        const out = await res.json();
        if (!out.ok) throw new Error(out.error || "failed to load heartbeat");
        const hb = out.heartbeat || {};
        hbIntervalInput.value = String(Number(hb.interval) || Number(hbToggle?.dataset.interval) || 15);
        hbPromptInput.value = typeof hb.prompt === "string" ? hb.prompt : (hbToggle?.dataset.prompt || "");
        hbModalStatus.textContent = "";
      } catch (err) {
        hbModalStatus.textContent = "\u5931\u8d25: " + String(err instanceof Error ? err.message : err);
      }
    }

    if (settingsBtn && settingsModal) {
      settingsBtn.addEventListener("click", async () => {
        settingsModal.classList.toggle("open");
        if (settingsModal.classList.contains("open")) await loadSettings();
      });
    }

    if (settingsClose && settingsModal) {
      settingsClose.addEventListener("click", () => settingsModal.classList.remove("open"));
    }
    if (hbConfig) {
      hbConfig.addEventListener("click", openHeartbeatConfig);
    }
    if (hbModalClose) {
      hbModalClose.addEventListener("click", closeHeartbeatModal);
    }
    if (hbCancelBtn) {
      hbCancelBtn.addEventListener("click", closeHeartbeatModal);
    }
    if (infoOpen) {
      infoOpen.addEventListener("click", openTechnicalInfo);
    }
    if (infoClose && infoModal) {
      infoClose.addEventListener("click", () => {
        infoModal.classList.remove("open");
        infoModal.setAttribute("aria-hidden", "true");
      });
    }
    document.addEventListener("click", (event) => {
      if (!settingsModal || !settingsBtn) return;
      if (!settingsModal.classList.contains("open")) return;
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (settingsModal.contains(target) || settingsBtn.contains(target)) return;
      settingsModal.classList.remove("open");
    });
    document.addEventListener("click", (event) => {
      if (!hbModal) return;
      if (!hbModal.classList.contains("open")) return;
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (target === hbModal) closeHeartbeatModal();
    });
    document.addEventListener("click", (event) => {
      if (!infoModal) return;
      if (!infoModal.classList.contains("open")) return;
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (target === infoModal) {
        infoModal.classList.remove("open");
        infoModal.setAttribute("aria-hidden", "true");
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (hbModal && hbModal.classList.contains("open")) {
        closeHeartbeatModal();
      } else if (infoModal && infoModal.classList.contains("open")) {
        infoModal.classList.remove("open");
        infoModal.setAttribute("aria-hidden", "true");
      } else if (settingsModal && settingsModal.classList.contains("open")) {
        settingsModal.classList.remove("open");
      }
    });

    if (hbToggle) {
      hbToggle.addEventListener("click", async () => {
        if (hbBusy) return;
        const current = hbToggle.dataset.enabled === "1";
        const intervalMinutes = Number(hbToggle.dataset.interval) || 15;
        const currentPrompt = hbToggle.dataset.prompt || "";
        const next = !current;
        hbBusy = true;
        hbToggle.disabled = true;
        setHeartbeatUi(next, next ? "\u5df2\u542f\u7528" : "\u5df2\u7981\u7528", intervalMinutes, currentPrompt);
        try {
          const res = await fetch("/api/settings/heartbeat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ enabled: next }),
          });
          const out = await res.json();
          if (!out.ok) throw new Error(out.error || "save failed");
          if (out.heartbeat) {
            setHeartbeatUi(Boolean(out.heartbeat.enabled), undefined, Number(out.heartbeat.interval) || intervalMinutes, typeof out.heartbeat.prompt === "string" ? out.heartbeat.prompt : currentPrompt);
          }
          await refreshState();
        } catch {
          setHeartbeatUi(current, current ? "\u5df2\u542f\u7528" : "\u5df2\u7981\u7528", intervalMinutes, currentPrompt);
        } finally {
          hbBusy = false;
          hbToggle.disabled = false;
        }
      });
    }

    if (hbForm && hbIntervalInput && hbPromptInput && hbModalStatus && hbSaveBtn && hbCancelBtn) {
      hbForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (hbSaveBusy) return;

        const interval = Number(String(hbIntervalInput.value || "").trim());
        const prompt = String(hbPromptInput.value || "").trim();
        if (!Number.isFinite(interval) || interval < 1 || interval > 1440) {
          hbModalStatus.textContent = "\u95f4\u9694\u5fc5\u987b\u5728 1-1440 \u5206\u949f\u4e4b\u95f4\u3002";
          return;
        }
        if (!prompt) {
          hbModalStatus.textContent = "\u63d0\u793a\u8bcd\u4e0d\u80fd\u4e3a\u7a7a\u3002";
          return;
        }

        hbSaveBusy = true;
        hbSaveBtn.disabled = true;
        hbCancelBtn.disabled = true;
        hbModalStatus.textContent = "\u4fdd\u5b58\u4e2d...";
        try {
          const res = await fetch("/api/settings/heartbeat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              interval,
              prompt,
            }),
          });
          const out = await res.json();
          if (!out.ok) throw new Error(out.error || "save failed");
          const enabled = hbToggle ? hbToggle.dataset.enabled === "1" : false;
          const next = out.heartbeat || {};
          setHeartbeatUi(
            "enabled" in next ? Boolean(next.enabled) : enabled,
            undefined,
            Number(next.interval) || interval,
            typeof next.prompt === "string" ? next.prompt : prompt
          );
          hbModalStatus.textContent = "\u5df2\u4fdd\u5b58\u3002";
          await refreshState();
          setTimeout(() => closeHeartbeatModal(), 120);
        } catch (err) {
          hbModalStatus.textContent = "\u5931\u8d25: " + String(err instanceof Error ? err.message : err);
          hbSaveBusy = false;
          hbSaveBtn.disabled = false;
          hbCancelBtn.disabled = false;
        }
      });
    }

    function renderClockToggle() {
      if (!clockToggle) return;
      clockToggle.textContent = use12Hour ? "12h" : "24h";
      clockToggle.className = "hb-toggle " + (use12Hour ? "on" : "off");
      if (clockInfoEl) clockInfoEl.textContent = use12Hour ? "12\u5c0f\u65f6\u5236" : "24\u5c0f\u65f6\u5236";
    }

    if (clockToggle) {
      renderClockToggle();
      clockToggle.addEventListener("click", () => {
        use12Hour = !use12Hour;
        localStorage.setItem("clock.format", use12Hour ? "12" : "24");
        renderClockToggle();
        renderClock();
        updateQuickJobUi();
      });
    }

    if (quickJobOffset && !quickJobOffset.value) {
      quickJobOffset.value = "10";
    }

    function normalizeOffsetMinutes(value) {
      const n = Number(String(value || "").trim());
      if (!Number.isFinite(n)) return null;
      const rounded = Math.round(n);
      if (rounded < 1 || rounded > 1440) return null;
      return rounded;
    }

    function computeTimeFromOffset(offsetMinutes) {
      const targetInstant = new Date(Date.now() + offsetMinutes * 60_000);
      const dt = toOffsetDate(targetInstant);
      const hour = dt.getUTCHours();
      const minute = dt.getUTCMinutes();
      const time = String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0");
      const dayLabel = isSameOffsetDay(targetInstant, new Date()) ? "\u4eca\u5929" : "\u660e\u5929";
      const human = formatOffsetDate(targetInstant, {
        hour: "numeric",
        minute: "2-digit",
        hour12: use12Hour,
      });
      return { hour, minute, time, dayLabel, human };
    }

    function formatPreviewTime(hour, minute) {
      const shiftedNow = toOffsetDate(new Date());
      shiftedNow.setUTCHours(hour, minute, 0, 0);
      const instant = new Date(shiftedNow.getTime() - heartbeatTimezoneOffsetMinutes * 60_000);
      return formatOffsetDate(instant, {
        hour: "numeric",
        minute: "2-digit",
        hour12: use12Hour,
      });
    }

    function formatOffsetDuration(offsetMinutes) {
      const total = Math.max(0, Math.round(offsetMinutes));
      const hours = Math.floor(total / 60);
      const minutes = total % 60;
      if (hours <= 0) return minutes + "m";
      if (minutes === 0) return hours + "h";
      return hours + "h " + minutes + "m";
    }

    function updateQuickJobUi() {
      if (quickJobPrompt && quickJobCount) {
        const count = (quickJobPrompt.value || "").trim().length;
        quickJobCount.textContent = String(count) + " \u5b57\u7b26";
      }
      if (quickJobOffset && quickJobPreview) {
        const offset = normalizeOffsetMinutes(quickJobOffset.value || "");
        if (!offset) {
          quickJobPreview.textContent = "\u8bf7\u8f93\u5165 1-1440 \u5206\u949f";
          quickJobPreview.style.color = "#ffd39f";
          return;
        }
        const target = computeTimeFromOffset(offset);
        const human = formatPreviewTime(target.hour, target.minute) || target.time;
        quickJobPreview.textContent = formatOffsetDuration(offset) + " \u540e\u8fd0\u884c (" + target.dayLabel + " " + human + ")";
        quickJobPreview.style.color = "#a8f1ca";
      }
    }

    if (quickJobOffset) quickJobOffset.addEventListener("input", updateQuickJobUi);
    if (quickJobPrompt) quickJobPrompt.addEventListener("input", updateQuickJobUi);

    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const add = target.closest("[data-add-minutes]");
      if (!add || !(add instanceof HTMLElement)) return;
      if (!quickJobOffset) return;
      const delta = Number(add.getAttribute("data-add-minutes") || "");
      if (!Number.isFinite(delta)) return;
      const current = normalizeOffsetMinutes(quickJobOffset.value) || 10;
      const next = Math.min(1440, current + Math.round(delta));
      quickJobOffset.value = String(next);
      updateQuickJobUi();
    });

    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const row = target.closest("[data-toggle-job]");
      if (!row || !(row instanceof HTMLElement)) return;
      const name = row.getAttribute("data-toggle-job") || "";
      if (!name) return;
      toggleJobDetails(name);
    });

    document.addEventListener("click", async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const button = target.closest("[data-delete-job]");
      if (!button || !(button instanceof HTMLButtonElement)) return;
      const name = button.getAttribute("data-delete-job") || "";
      if (!name) return;
      button.disabled = true;
      if (quickJobsStatus) quickJobsStatus.textContent = "\u5220\u9664\u4efb\u52a1\u4e2d...";
      try {
        const res = await fetch("/api/jobs/" + encodeURIComponent(name), { method: "DELETE" });
        const out = await res.json();
        if (!out.ok) throw new Error(out.error || "delete failed");
        if (quickJobsStatus) quickJobsStatus.textContent = "\u5df2\u5220\u9664 " + name;
        await refreshState();
      } catch (err) {
        if (quickJobsStatus) quickJobsStatus.textContent = "\u5931\u8d25: " + String(err instanceof Error ? err.message : err);
      } finally {
        button.disabled = false;
      }
    });

    if (quickOpenCreate) {
      quickOpenCreate.addEventListener("click", () => setQuickView("create", { scroll: true, user: true }));
    }

    if (quickBackJobs) {
      quickBackJobs.addEventListener("click", () => setQuickView("jobs", { scroll: true, user: true }));
    }

    if (quickJobForm && quickJobOffset && quickJobPrompt && quickJobSubmit && quickJobStatus) {
      quickJobForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const offset = normalizeOffsetMinutes(quickJobOffset.value || "");
        const prompt = (quickJobPrompt.value || "").trim();
        if (!offset || !prompt) {
          quickJobStatus.textContent = "\u8bf7\u8f93\u5165 1-1440 \u5206\u949f\u5e76\u6dfb\u52a0\u63d0\u793a\u8bcd\u3002";
          return;
        }
        const target = computeTimeFromOffset(offset);
        quickJobSubmit.disabled = true;
        quickJobStatus.textContent = "\u4fdd\u5b58\u4efb\u52a1\u4e2d...";
        try {
          const res = await fetch("/api/jobs/quick", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              time: target.time,
              prompt,
              recurring: quickJobRecurring ? quickJobRecurring.checked : true,
            }),
          });
          const out = await res.json();
          if (!out.ok) throw new Error(out.error || "failed");
          quickJobStatus.textContent = "\u5df2\u6dfb\u52a0\u5230\u4efb\u52a1\u5217\u8868\u3002";
          if (quickJobsStatus) quickJobsStatus.textContent = "\u5df2\u6dfb\u52a0 " + out.name;
          quickJobPrompt.value = "";
          updateQuickJobUi();
          setQuickView("jobs", { scroll: true });
          await refreshState();
        } catch (err) {
          quickJobStatus.textContent = "\u5931\u8d25: " + String(err instanceof Error ? err.message : err);
        } finally {
          quickJobSubmit.disabled = false;
        }
      });
    }

    function esc(s) {
      return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function escAttr(s) {
      return esc(String(s)).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }

    renderClock();
    setInterval(renderClock, 1000);
    startTypewriter();
    updateQuickJobUi();
    setQuickView(quickView);

    loadSettings();
    refreshState();
    setInterval(refreshState, 1000);

    // ── Chat (multi-conversation) ──
    const tabDashboardBtn = $("tab-dashboard");
    const tabChatBtn = $("tab-chat");
    const tabAnalyticsBtn = $("tab-analytics");
    const dashboardPanel = $("dashboard-panel");
    const chatPanel = $("chat-panel");
    const analyticsPanel = $("analytics-panel");
    const analyticsGrid = $("analytics-grid");
    const chatMessages = $("chat-messages");
    const chatForm = $("chat-form");
    const chatInput = $("chat-input");
    const chatSend = $("chat-send");
    const chatNewBtn = $("chat-new-btn");
    const chatConvList = $("chat-conv-list");

    var CHAT_STORAGE_KEY = "claudeclaw.chat.history";
    var CHAT_MIGRATED_KEY = "claudeclaw.chat.migrated";
    let chatBusy = false;
    let chatAbortController = null;
    let chatElapsedTimer = null;
    let chatStartedAt = 0;
    let chatHistory = [];
    let conversations = [];
    let activeConvId = null;

    function setActiveTab(tab) {
      const allBtns = [tabDashboardBtn, tabChatBtn, tabAnalyticsBtn];
      const allPanels = [dashboardPanel, chatPanel, analyticsPanel];
      allBtns.forEach(b => { if (b) { b.classList.remove("tab-btn-active"); b.setAttribute("aria-selected", "false"); } });
      allPanels.forEach(p => { if (p) p.hidden = true; });

      if (tab === "dashboard") {
        tabDashboardBtn && tabDashboardBtn.classList.add("tab-btn-active");
        tabDashboardBtn && tabDashboardBtn.setAttribute("aria-selected", "true");
        if (dashboardPanel) dashboardPanel.hidden = false;
      } else if (tab === "analytics") {
        tabAnalyticsBtn && tabAnalyticsBtn.classList.add("tab-btn-active");
        tabAnalyticsBtn && tabAnalyticsBtn.setAttribute("aria-selected", "true");
        if (analyticsPanel) analyticsPanel.hidden = false;
        loadAnalytics();
      } else {
        tabChatBtn && tabChatBtn.classList.add("tab-btn-active");
        tabChatBtn && tabChatBtn.setAttribute("aria-selected", "true");
        if (chatPanel) chatPanel.hidden = false;
        if (chatInput) chatInput.focus();
        loadConversations();
      }
    }

    if (tabDashboardBtn) tabDashboardBtn.addEventListener("click", () => setActiveTab("dashboard"));
    if (tabChatBtn) tabChatBtn.addEventListener("click", () => setActiveTab("chat"));
    if (tabAnalyticsBtn) tabAnalyticsBtn.addEventListener("click", () => setActiveTab("analytics"));

    function fmtConvDate(isoStr) {
      try {
        var d = toOffsetDate(new Date(isoStr));
        var now = toOffsetDate(new Date());
        var isToday = d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth() && d.getUTCDate() === now.getUTCDate();
        var yesterday = new Date(now.getTime() - 86400000);
        var isYesterday = d.getUTCFullYear() === yesterday.getUTCFullYear() && d.getUTCMonth() === yesterday.getUTCMonth() && d.getUTCDate() === yesterday.getUTCDate();
        if (isToday) return "\u4eca\u5929";
        if (isYesterday) return "\u6628\u5929";
        return (d.getUTCMonth() + 1) + "/" + d.getUTCDate();
      } catch (_) { return ""; }
    }

    function renderConvList() {
      if (!chatConvList) return;
      if (!conversations.length) {
        chatConvList.innerHTML = '<div class="chat-conv-empty">\u8fd8\u6ca1\u6709\u5bf9\u8bdd</div>';
        return;
      }
      chatConvList.innerHTML = conversations.map(function(c) {
        var active = c.id === activeConvId ? " active" : "";
        return '<div class="chat-conv-item' + active + '" data-conv-id="' + escAttr(c.id) + '">' +
          '<span class="chat-conv-title">' + esc(c.title || "\u65b0\u5bf9\u8bdd") + '</span>' +
          '<span class="chat-conv-date">' + esc(fmtConvDate(c.updatedAt)) + '</span>' +
          '<button class="chat-conv-delete" data-conv-delete="' + escAttr(c.id) + '" type="button">\u00d7</button>' +
        '</div>';
      }).join("");
    }

    async function loadConversations() {
      try {
        var res = await fetch("/api/conversations");
        var data = await res.json();
        conversations = data.conversations || [];
        renderConvList();
        if (!localStorage.getItem(CHAT_MIGRATED_KEY)) {
          await migrateLocalStorage();
        }
      } catch (_) {
        conversations = [];
        renderConvList();
      }
    }

    async function migrateLocalStorage() {
      try {
        var saved = localStorage.getItem(CHAT_STORAGE_KEY);
        if (!saved) { localStorage.setItem(CHAT_MIGRATED_KEY, "1"); return; }
        var msgs = JSON.parse(saved);
        if (!Array.isArray(msgs) || msgs.length === 0) { localStorage.setItem(CHAT_MIGRATED_KEY, "1"); return; }
        var res = await fetch("/api/conversations/migrate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: msgs }),
        });
        var out = await res.json();
        if (out.ok) {
          localStorage.removeItem(CHAT_STORAGE_KEY);
          localStorage.setItem(CHAT_MIGRATED_KEY, "1");
          await loadConversations();
          if (out.conversation && out.conversation.id) {
            await selectConversation(out.conversation.id);
          }
        }
      } catch (_) {}
    }

    async function selectConversation(id) {
      activeConvId = id;
      renderConvList();
      try {
        var res = await fetch("/api/conversations/" + encodeURIComponent(id));
        var data = await res.json();
        if (data.ok && data.conversation) {
          chatHistory = data.conversation.messages.map(function(m) {
            return { role: m.role, text: m.text };
          });
        } else {
          chatHistory = [];
        }
      } catch (_) {
        chatHistory = [];
      }
      renderChatHistory();
    }

    async function createNewConversation() {
      try {
        var res = await fetch("/api/conversations", { method: "POST" });
        var data = await res.json();
        if (data.ok && data.conversation) {
          await loadConversations();
          await selectConversation(data.conversation.id);
        }
      } catch (_) {}
    }

    async function deleteConversation(id) {
      try {
        await fetch("/api/conversations/" + encodeURIComponent(id), { method: "DELETE" });
        if (activeConvId === id) {
          activeConvId = null;
          chatHistory = [];
          renderChatHistory();
        }
        await loadConversations();
      } catch (_) {}
    }

    if (chatNewBtn) {
      chatNewBtn.addEventListener("click", createNewConversation);
    }

    if (chatConvList) {
      chatConvList.addEventListener("click", function(e) {
        var target = e.target;
        if (!(target instanceof HTMLElement)) return;
        var delBtn = target.closest("[data-conv-delete]");
        if (delBtn) {
          e.stopPropagation();
          var delId = delBtn.getAttribute("data-conv-delete");
          if (delId) deleteConversation(delId);
          return;
        }
        var item = target.closest("[data-conv-id]");
        if (item) {
          var convId = item.getAttribute("data-conv-id");
          if (convId && convId !== activeConvId) selectConversation(convId);
        }
      });
    }

    function fmtElapsed(ms) {
      var s = Math.floor(ms / 1000);
      if (s < 60) return s + "s";
      return Math.floor(s / 60) + "m " + (s % 60) + "s";
    }

    function setChatBusy(busy) {
      chatBusy = busy;
      var cancelBtn = $("chat-cancel");
      if (chatSend) chatSend.disabled = busy;
      if (cancelBtn) cancelBtn.hidden = !busy;
      if (busy) {
        chatStartedAt = Date.now();
        chatElapsedTimer = setInterval(function() {
          var el = document.querySelector(".chat-msg-elapsed");
          if (el) el.textContent = fmtElapsed(Date.now() - chatStartedAt);
        }, 1000);
      } else {
        if (chatElapsedTimer) { clearInterval(chatElapsedTimer); chatElapsedTimer = null; }
        chatAbortController = null;
      }
    }

    function cancelChat() {
      if (chatAbortController) chatAbortController.abort();
    }

    function createChatEmptyState() {
      var empty = document.createElement("div");
      empty.className = "chat-empty";
      empty.textContent = activeConvId ? "\u53d1\u9001\u6d88\u606f\u5f00\u59cb\u5bf9\u8bdd\u3002" : "\u9009\u62e9\u4e00\u4e2a\u5bf9\u8bdd\u6216\u521b\u5efa\u65b0\u5bf9\u8bdd\u3002";
      return empty;
    }

    function createChatMessageEl() {
      var msgEl = document.createElement("div");
      var roleEl = document.createElement("div");
      roleEl.className = "chat-msg-role";
      var textEl = document.createElement("div");
      textEl.className = "chat-msg-text";
      msgEl.appendChild(roleEl);
      msgEl.appendChild(textEl);
      return msgEl;
    }

    function syncChatMessageEl(msgEl, msg, elapsedMs) {
      var roleEl = msgEl.querySelector(".chat-msg-role");
      var textEl = msgEl.querySelector(".chat-msg-text");
      if (!roleEl || !textEl) {
        msgEl.textContent = "";
        roleEl = document.createElement("div");
        roleEl.className = "chat-msg-role";
        textEl = document.createElement("div");
        textEl.className = "chat-msg-text";
        msgEl.appendChild(roleEl);
        msgEl.appendChild(textEl);
      }

      var cls = "chat-msg " + (msg.role === "user" ? "chat-msg-user" : "chat-msg-assistant");
      if (msg.streaming) cls += " chat-msg-streaming";
      msgEl.className = cls;
      roleEl.textContent = msg.role === "user" ? "\u4f60" : "Claude";
      textEl.textContent = msg.text || "";

      var metaEl = msgEl.querySelector(".chat-msg-elapsed, .chat-msg-background");
      if (msg.streaming && chatBusy) {
        if (!metaEl || !metaEl.classList.contains("chat-msg-elapsed")) {
          if (metaEl) metaEl.remove();
          metaEl = document.createElement("div");
          metaEl.className = "chat-msg-elapsed";
          msgEl.appendChild(metaEl);
        }
        metaEl.textContent = fmtElapsed(elapsedMs);
      } else if (msg.background) {
        if (!metaEl || !metaEl.classList.contains("chat-msg-background")) {
          if (metaEl) metaEl.remove();
          metaEl = document.createElement("div");
          metaEl.className = "chat-msg-background";
          msgEl.appendChild(metaEl);
        }
        metaEl.textContent = "\u2699 \u540e\u53f0\u8fd0\u884c\u4e2d...";
      } else if (metaEl) {
        metaEl.remove();
      }
    }

    function renderChatHistory() {
      if (!chatMessages) return;
      if (!chatHistory.length) {
        if (
          chatMessages.children.length !== 1 ||
          !chatMessages.firstElementChild ||
          !chatMessages.firstElementChild.classList.contains("chat-empty")
        ) {
          chatMessages.textContent = "";
          chatMessages.appendChild(createChatEmptyState());
        }
        return;
      }

      if (chatMessages.firstElementChild && chatMessages.firstElementChild.classList.contains("chat-empty")) {
        chatMessages.textContent = "";
      }

      var elapsedMs = Date.now() - chatStartedAt;

      for (var i = 0; i < chatHistory.length; i++) {
        var msgEl = chatMessages.children[i];
        if (!msgEl || !msgEl.classList.contains("chat-msg")) {
          msgEl = createChatMessageEl();
          if (i >= chatMessages.children.length) {
            chatMessages.appendChild(msgEl);
          } else {
            chatMessages.insertBefore(msgEl, chatMessages.children[i]);
          }
        }
        syncChatMessageEl(msgEl, chatHistory[i], elapsedMs);
      }

      while (chatMessages.children.length > chatHistory.length) {
        chatMessages.removeChild(chatMessages.lastElementChild);
      }

      chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function autoResizeChatInput() {
      if (!chatInput) return;
      chatInput.style.height = "auto";
      chatInput.style.height = Math.min(chatInput.scrollHeight, 160) + "px";
    }

    async function sendChat() {
      if (chatBusy || !chatInput) return;
      var message = (chatInput.value || "").trim();
      if (!message) return;

      // Auto-create conversation if none selected
      if (!activeConvId) {
        try {
          var createRes = await fetch("/api/conversations", { method: "POST" });
          var createData = await createRes.json();
          if (createData.ok && createData.conversation) {
            activeConvId = createData.conversation.id;
            await loadConversations();
          }
        } catch (_) {}
      }

      chatInput.value = "";
      autoResizeChatInput();
      setChatBusy(true);

      chatHistory.push({ role: "user", text: message });
      var assistantIdx = chatHistory.length;
      chatHistory.push({ role: "assistant", text: "", streaming: true });
      renderChatHistory();

      chatAbortController = new AbortController();

      try {
        var res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: message, conversationId: activeConvId || "" }),
          signal: chatAbortController.signal,
        });

        if (!res.body) throw new Error("No response body");

        var reader = res.body.getReader();
        var dec = new TextDecoder();
        var buf = "";

        while (true) {
          var read = await reader.read();
          if (read.done) break;
          buf += dec.decode(read.value, { stream: true });
          var lines = buf.split("\n");
          buf = lines.pop() || "";
          for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            if (!line.startsWith("data: ")) continue;
            try {
              var ev = JSON.parse(line.slice(6));
              if (ev.type === "chunk") {
                chatHistory[assistantIdx].text += ev.text;
                renderChatHistory();
              } else if (ev.type === "unblock") {
                // Claude has acknowledged — unblock the input so user can send more messages
                // while the background task continues running
                setChatBusy(false);
                chatHistory[assistantIdx].background = true;
                renderChatHistory();
              } else if (ev.type === "done") {
                chatHistory[assistantIdx].streaming = false;
                chatHistory[assistantIdx].background = false;
                renderChatHistory();
                loadConversations();
              } else if (ev.type === "error") {
                chatHistory[assistantIdx].text = chatHistory[assistantIdx].text
                  ? chatHistory[assistantIdx].text + "\n\n[Error: " + ev.message + "]"
                  : "[Error: " + ev.message + "]";
                chatHistory[assistantIdx].streaming = false;
                chatHistory[assistantIdx].background = false;
                renderChatHistory();
                loadConversations();
              }
            } catch (_) {}
          }
        }
        chatHistory[assistantIdx].streaming = false;
        renderChatHistory();
        loadConversations();
      } catch (err) {
        var cancelled = err && err.name === "AbortError";
        chatHistory[assistantIdx].text = cancelled
          ? (chatHistory[assistantIdx].text || "[\u5df2\u53d6\u6d88]")
          : "[\u5931\u8d25: " + String(err) + "]";
        chatHistory[assistantIdx].streaming = false;
        renderChatHistory();
        loadConversations();
      } finally {
        setChatBusy(false);
        if (chatInput) chatInput.focus();
      }
    }

    if (chatForm) {
      chatForm.addEventListener("submit", function(e) {
        e.preventDefault();
        sendChat();
      });
    }

    if (chatInput) {
      chatInput.addEventListener("input", autoResizeChatInput);
      chatInput.addEventListener("keydown", function(e) {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          sendChat();
        }
      });
    }

    var chatCancelBtn = $("chat-cancel");
    if (chatCancelBtn) {
      chatCancelBtn.addEventListener("click", cancelChat);
    }

    // Update elapsed timer in-place every second (no full re-render = no blink).
    setInterval(function() {
      if (chatBusy && chatMessages) {
        var elapsedEl = chatMessages.querySelector(".chat-msg-elapsed");
        if (elapsedEl) elapsedEl.textContent = fmtElapsed(Date.now() - chatStartedAt);
      }
    }, 1000);

    // ── Analytics ──
    async function loadAnalytics() {
      if (!analyticsGrid) return;
      analyticsGrid.innerHTML = '<div class="analytics-loading">\u52a0\u8f7d\u5206\u6790\u6570\u636e...</div>';

      try {
        var res = await fetch("/api/analytics");
        var data = await res.json();
        renderAnalytics(data);
      } catch (err) {
        analyticsGrid.innerHTML = '<div class="analytics-loading">\u52a0\u8f7d\u5931\u8d25</div>';
      }
    }

    function renderAnalytics(data) {
      if (!analyticsGrid) return;

      var daily = data.dailyCounts || [];
      var maxCount = Math.max(1, ...daily.map(function(d) { return d.count; }));

      var barChart = daily.map(function(d) {
        var h = Math.max(2, (d.count / maxCount) * 100);
        return '<div class="analytics-bar" style="height:' + h + 'px" title="' + esc(d.date) + ': ' + d.count + '"></div>';
      }).join("");

      var barLabels = '<div class="analytics-bar-label"><span>' + esc(daily.length > 0 ? daily[0].date.slice(5) : "") + '</span><span>' + esc(daily.length > 0 ? daily[daily.length - 1].date.slice(5) : "") + '</span></div>';

      var sources = Object.entries(data.sourceBreakdown || {});
      var sourceList = sources.length > 0
        ? '<ul class="analytics-source-list">' + sources.map(function(s) {
            return '<li class="analytics-source-item"><span>' + esc(s[0]) + '</span><span class="analytics-source-count">' + s[1] + '</span></li>';
          }).join("") + '</ul>'
        : '<div class="analytics-card-sub">\u6682\u65e0\u6570\u636e</div>';

      analyticsGrid.innerHTML =
        '<div class="analytics-card">' +
          '<div class="analytics-card-title">\u603b\u6267\u884c\u6b21\u6570</div>' +
          '<div class="analytics-card-value">' + (data.totalSessions || 0) + '</div>' +
          '<div class="analytics-card-sub">\u65e5\u5fd7\u6587\u4ef6\u603b\u6570</div>' +
        '</div>' +
        '<div class="analytics-card">' +
          '<div class="analytics-card-title">\u8bb0\u5fc6\u6761\u76ee</div>' +
          '<div class="analytics-card-value">' + (data.memoryCount || 0) + '</div>' +
          '<div class="analytics-card-sub">\u6301\u4e45\u8bb0\u5fc6\u5e93\u4e2d</div>' +
        '</div>' +
        '<div class="analytics-card" style="grid-column:1/-1">' +
          '<div class="analytics-card-title">\u8fd1 7 \u5929\u6d3b\u8dc3\u5ea6</div>' +
          '<div class="analytics-bar-chart">' + barChart + '</div>' +
          barLabels +
        '</div>' +
        '<div class="analytics-card">' +
          '<div class="analytics-card-title">\u6765\u6e90\u5206\u5e03</div>' +
          sourceList +
        '</div>';
    }`;
