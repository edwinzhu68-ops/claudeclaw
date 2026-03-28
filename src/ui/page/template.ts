import { pageStyles } from "./styles";
import { pageScript } from "./script";

function decodeUnicodeEscapes(text: string): string {
  const decodedCodePoints = text.replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, hex: string) => {
    const codePoint = Number.parseInt(hex, 16);
    return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : _;
  });
  return decodedCodePoints.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) => {
    const code = Number.parseInt(hex, 16);
    return Number.isFinite(code) ? String.fromCharCode(code) : _;
  });
}

export function htmlPage(): string {
  const html = String.raw`
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ClaudeClaw</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,500&family=Space+Grotesk:wght@400;500;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <style>
${pageStyles}
  </style>
</head>
<body>
  <div class="grain" aria-hidden="true"></div>
  <a
    class="repo-cta"
    href="https://github.com/moazbuilds/claudeclaw"
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Star claudeclaw on GitHub"
  >
    <span class="repo-text">\u559c\u6b22 ClaudeClaw\uff1f\u5728 GitHub \u4e0a\u7ed9\u4e2a Star</span>
    <span class="repo-star">★</span>
  </a>
  <button class="settings-btn" id="settings-btn" type="button">\u8bbe\u7f6e</button>
  <aside class="settings-modal" id="settings-modal" aria-live="polite">
    <div class="settings-head">
      <span>\u8bbe\u7f6e</span>
      <button class="settings-close" id="settings-close" type="button" aria-label="\u5173\u95ed\u8bbe\u7f6e">\u00d7</button>
    </div>
    <div class="settings-stack">
      <div class="setting-item">
        <div class="setting-main">
          <div class="settings-label">\ud83d\udc93 \u5fc3\u8df3</div>
          <div class="settings-meta" id="hb-info">\u540c\u6b65\u4e2d...</div>
        </div>
        <div class="setting-actions">
          <button class="hb-config" id="hb-config" type="button">\u914d\u7f6e</button>
          <button class="hb-toggle" id="hb-toggle" type="button">\u52a0\u8f7d\u4e2d...</button>
        </div>
      </div>
      <div class="setting-item">
        <div class="setting-main">
          <div class="settings-label">\ud83d\udd52 \u65f6\u949f</div>
          <div class="settings-meta" id="clock-info">24\u5c0f\u65f6\u5236</div>
        </div>
        <button class="hb-toggle" id="clock-toggle" type="button">24h</button>
      </div>
      <div class="setting-item">
        <div class="setting-main">
          <div class="settings-label">\ud83e\uddfe \u9ad8\u7ea7</div>
          <div class="settings-meta">\u8fd0\u884c\u65f6\u6280\u672f\u4fe1\u606f\u548c JSON \u6587\u4ef6</div>
        </div>
        <button class="hb-toggle on" id="info-open" type="button">\u8be6\u60c5</button>
      </div>
    </div>
  </aside>
  <section class="info-modal" id="hb-modal" aria-live="polite" aria-hidden="true">
    <article class="hb-card">
      <div class="info-head">
        <span>\u5fc3\u8df3\u914d\u7f6e</span>
        <button class="settings-close" id="hb-modal-close" type="button" aria-label="\u5173\u95ed\u5fc3\u8df3\u914d\u7f6e">\u00d7</button>
      </div>
      <form class="hb-form" id="hb-form">
        <label class="hb-field" for="hb-interval-input">
          <span class="hb-label">\u95f4\u9694\uff08\u5206\u949f\uff09</span>
          <input class="hb-input" id="hb-interval-input" type="number" min="1" max="1440" step="1" required />
        </label>
        <label class="hb-field" for="hb-prompt-input">
          <span class="hb-label">\u81ea\u5b9a\u4e49\u63d0\u793a\u8bcd</span>
          <textarea class="hb-textarea" id="hb-prompt-input" placeholder="\u5fc3\u8df3\u8981\u6267\u884c\u4ec0\u4e48\uff1f" required></textarea>
        </label>
        <div class="hb-actions">
          <div class="hb-status" id="hb-modal-status"></div>
          <div class="hb-buttons">
            <button class="hb-btn ghost" id="hb-cancel-btn" type="button">\u53d6\u6d88</button>
            <button class="hb-btn solid" id="hb-save-btn" type="submit">\u4fdd\u5b58</button>
          </div>
        </div>
      </form>
    </article>
  </section>
  <section class="info-modal" id="info-modal" aria-live="polite" aria-hidden="true">
    <article class="info-card">
      <div class="info-head">
        <span>\u9ad8\u7ea7\u6280\u672f\u4fe1\u606f</span>
        <button class="settings-close" id="info-close" type="button" aria-label="\u5173\u95ed\u6280\u672f\u4fe1\u606f">\u00d7</button>
      </div>
      <div class="info-body" id="info-body">
        <div class="info-section">
          <div class="info-title">\u52a0\u8f7d\u4e2d</div>
          <pre class="info-json">\u6b63\u5728\u52a0\u8f7d\u6280\u672f\u6570\u636e...</pre>
        </div>
      </div>
    </article>
  </section>
  <main class="stage">
    <nav class="tab-nav" role="tablist" aria-label="Main navigation">
      <button class="tab-btn tab-btn-active" id="tab-dashboard" type="button" role="tab" aria-selected="true" aria-controls="dashboard-panel">\u4eea\u8868\u76d8</button>
      <button class="tab-btn" id="tab-chat" type="button" role="tab" aria-selected="false" aria-controls="chat-panel">\u5bf9\u8bdd</button>
      <button class="tab-btn" id="tab-analytics" type="button" role="tab" aria-selected="false" aria-controls="analytics-panel">\u5206\u6790</button>
    </nav>
    <div id="dashboard-panel">
    <section class="hero">
      <div class="logo-art" role="img" aria-label="Lobster ASCII art logo">
        <div class="logo-top"><span>🦞</span><span>🦞</span></div>
        <pre class="logo-body">   ▐▛███▜▌
  ▝▜█████▛▘
    ▘▘ ▝▝</pre>
      </div>
      <div class="typewriter" id="typewriter" aria-live="polite"></div>
      <div class="time" id="clock">--:--:--</div>
      <div class="date" id="date">\u52a0\u8f7d\u65e5\u671f\u4e2d...</div>
      <div class="message" id="message">\u6b22\u8fce\u56de\u6765\u3002</div>
      <section class="quick-job" id="quick-jobs-view">
        <div class="quick-job-head quick-job-head-row">
          <div>
            <div class="quick-job-title">\u4efb\u52a1\u5217\u8868</div>
            <div class="quick-job-sub">\u4ece\u8fd0\u884c\u65f6\u52a0\u8f7d\u7684\u5b9a\u65f6\u4efb\u52a1</div>
            <div class="quick-jobs-next" id="quick-jobs-next">\u4e0b\u4e00\u4e2a\u4efb\u52a1 --</div>
          </div>
          <button class="quick-open-create" id="quick-open-create" type="button">\u521b\u5efa\u4efb\u52a1</button>
        </div>
        <div class="quick-jobs-list quick-jobs-list-main" id="quick-jobs-list">
          <div class="quick-jobs-empty">\u52a0\u8f7d\u4efb\u52a1\u4e2d...</div>
        </div>
        <div class="quick-status" id="quick-jobs-status"></div>
      </section>
      <form class="quick-job quick-view-hidden" id="quick-job-form">
        <div class="quick-job-head">
          <div class="quick-job-title">\u6dfb\u52a0\u5b9a\u65f6\u4efb\u52a1</div>
          <div class="quick-job-sub">\u5e26\u63d0\u793a\u8bcd\u7684\u5b9a\u65f6\u8ba1\u5212\u4efb\u52a1</div>
        </div>
        <div class="quick-job-grid">
          <div class="quick-field quick-time-wrap">
            <div class="quick-label">\u5ef6\u8fdf\u65f6\u95f4\uff08\u5206\u949f\uff09</div>
            <div class="quick-input-wrap">
            <input class="quick-input" id="quick-job-offset" type="number" min="1" max="1440" step="1" placeholder="10" required />
              <label class="quick-check quick-check-inline" for="quick-job-recurring">
                <input id="quick-job-recurring" type="checkbox" checked />
                <span>\u5faa\u73af</span>
              </label>
            </div>
            <div class="quick-time-buttons">
              <button class="quick-add" type="button" data-add-minutes="15">+15m</button>
              <button class="quick-add" type="button" data-add-minutes="30">+30m</button>
              <button class="quick-add" type="button" data-add-minutes="60">+1h</button>
              <button class="quick-add" type="button" data-add-minutes="180">+3h</button>
            </div>
            <div class="quick-preview" id="quick-job-preview">-- \u5206\u949f\u540e\u8fd0\u884c</div>
          </div>
          <div class="quick-field">
            <div class="quick-label">\u63d0\u793a\u8bcd</div>
            <textarea class="quick-prompt" id="quick-job-prompt" placeholder="\u63d0\u9192\u6211\u559d\u6c34\u3002" required></textarea>
            <div class="quick-prompt-meta">
              <span id="quick-job-count">0 \u5b57\u7b26</span>
              <span>\u4fdd\u5b58\u5728\u8ba1\u7b97\u7684\u65f6\u949f\u65f6\u95f4</span>
            </div>
          </div>
        </div>
        <div class="quick-job-actions">
          <button class="quick-submit" id="quick-job-submit" type="submit">\u6dfb\u52a0\u5230\u4efb\u52a1\u5217\u8868</button>
          <div class="quick-status" id="quick-job-status"></div>
        </div>
        <div class="quick-form-foot">
          <button class="quick-back-jobs" id="quick-back-jobs" type="button">\u8fd4\u56de\u4efb\u52a1\u5217\u8868</button>
        </div>
      </form>
    </section>
    </div>
    <div id="chat-panel" class="chat-panel" hidden>
      <div class="chat-layout">
        <aside class="chat-sidebar" id="chat-sidebar">
          <div class="chat-sidebar-head">
            <button class="chat-new-btn" id="chat-new-btn" type="button">+ \u65b0\u5bf9\u8bdd</button>
          </div>
          <div class="chat-conv-list" id="chat-conv-list">
            <div class="chat-conv-empty">\u52a0\u8f7d\u4e2d...</div>
          </div>
        </aside>
        <div class="chat-main">
          <div id="chat-messages" class="chat-messages"></div>
          <div class="chat-input-area">
            <form id="chat-form" class="chat-form">
              <textarea
                id="chat-input"
                class="chat-input"
                placeholder="\u7ed9 Claude \u53d1\u6d88\u606f..."
                rows="1"
                autocomplete="off"
              ></textarea>
              <button id="chat-cancel" class="chat-cancel" type="button" hidden>\u53d6\u6d88</button>
              <button id="chat-send" class="chat-send" type="submit">\u53d1\u9001</button>
            </form>
          </div>
        </div>
      </div>
    </div>
    <div id="analytics-panel" class="analytics-panel" hidden>
      <div class="analytics-grid" id="analytics-grid">
        <div class="analytics-loading">\u52a0\u8f7d\u5206\u6790\u6570\u636e...</div>
      </div>
    </div>
  </main>

  <div class="dock-shell">
    <aside class="side-bubble" id="jobs-bubble" aria-live="polite">
      <div class="side-icon">🗂️</div>
      <div class="side-value">-</div>
      <div class="side-label">\u4efb\u52a1</div>
    </aside>
    <footer class="dock" id="dock" aria-live="polite">
      <div class="pill">\u8fde\u63a5\u4e2d...</div>
    </footer>
    <aside class="side-bubble" id="uptime-bubble" aria-live="polite">
      <div class="side-icon">\u23f1\ufe0f</div>
      <div class="side-value">-</div>
      <div class="side-label">\u8fd0\u884c\u65f6\u95f4</div>
    </aside>
  </div>

  <script>
${pageScript}
  </script>
</body>
</html>`;
  return decodeUnicodeEscapes(html);
}
