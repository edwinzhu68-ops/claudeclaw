import { htmlPage } from "./page/html";
import { clampInt, json } from "./http";
import type { StartWebUiOptions, WebServerHandle } from "./types";
import { buildState, buildTechnicalInfo, sanitizeSettings } from "./services/state";
import { readHeartbeatSettings, updateHeartbeatSettings } from "./services/settings";
import { createQuickJob, deleteJob } from "./services/jobs";
import { readLogs } from "./services/logs";
import { listChats, getChat, createChat, deleteChat, appendMessage, setChatSessionId } from "./services/chats";
import { listWebhooks, getWebhook, saveWebhook, deleteWebhook } from "./services/webhooks";
import { listMemories, getMemory, saveMemory, deleteMemory, searchMemories } from "../memory";
import { getAllHealth, resetJobHealth, loadHealth } from "../job-health";
import { verifyPairing, listPending } from "../pairing";
import { buildAnalytics } from "./services/analytics";
import { SETTINGS_FILE } from "./constants";
import { readFile, writeFile } from "fs/promises";

export function startWebUi(opts: StartWebUiOptions): WebServerHandle {
  const server = Bun.serve({
    hostname: opts.host,
    port: opts.port,
    idleTimeout: 0,
    fetch: async (req) => {
      const url = new URL(req.url);

      if (url.pathname === "/" || url.pathname === "/index.html") {
        return new Response(htmlPage(), {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      if (url.pathname === "/api/health") {
        return json({ ok: true, now: Date.now() });
      }

      if (url.pathname === "/api/state") {
        return json(await buildState(opts.getSnapshot()));
      }

      if (url.pathname === "/api/settings") {
        return json(sanitizeSettings(opts.getSnapshot().settings));
      }

      if (url.pathname === "/api/settings/heartbeat" && req.method === "POST") {
        try {
          const body = await req.json();
          const payload = body as {
            enabled?: unknown;
            interval?: unknown;
            prompt?: unknown;
            excludeWindows?: unknown;
          };
          const patch: {
            enabled?: boolean;
            interval?: number;
            prompt?: string;
            excludeWindows?: Array<{ days?: number[]; start: string; end: string }>;
          } = {};

          if ("enabled" in payload) patch.enabled = Boolean(payload.enabled);
          if ("interval" in payload) {
            const iv = Number(payload.interval);
            if (!Number.isFinite(iv)) throw new Error("interval must be numeric");
            patch.interval = iv;
          }
          if ("prompt" in payload) patch.prompt = String(payload.prompt ?? "");
          if ("excludeWindows" in payload) {
            if (!Array.isArray(payload.excludeWindows)) {
              throw new Error("excludeWindows must be an array");
            }
            patch.excludeWindows = payload.excludeWindows
              .filter((entry) => entry && typeof entry === "object")
              .map((entry) => {
                const row = entry as Record<string, unknown>;
                const start = String(row.start ?? "").trim();
                const end = String(row.end ?? "").trim();
                const days = Array.isArray(row.days)
                  ? row.days
                      .map((d) => Number(d))
                      .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
                  : undefined;
                return {
                  start,
                  end,
                  ...(days && days.length > 0 ? { days } : {}),
                };
              });
          }

          if (
            !("enabled" in patch) &&
            !("interval" in patch) &&
            !("prompt" in patch) &&
            !("excludeWindows" in patch)
          ) {
            throw new Error("no heartbeat fields provided");
          }

          const next = await updateHeartbeatSettings(patch);
          if (opts.onHeartbeatEnabledChanged && "enabled" in patch) {
            await opts.onHeartbeatEnabledChanged(Boolean(patch.enabled));
          }
          if (opts.onHeartbeatSettingsChanged) {
            await opts.onHeartbeatSettingsChanged(patch);
          }
          return json({ ok: true, heartbeat: next });
        } catch (err) {
          return json({ ok: false, error: String(err) });
        }
      }

      if (url.pathname === "/api/settings/heartbeat" && req.method === "GET") {
        try {
          return json({ ok: true, heartbeat: await readHeartbeatSettings() });
        } catch (err) {
          return json({ ok: false, error: String(err) });
        }
      }

      if (url.pathname === "/api/technical-info") {
        return json(await buildTechnicalInfo(opts.getSnapshot()));
      }

      if (url.pathname === "/api/jobs/quick" && req.method === "POST") {
        try {
          const body = await req.json();
          const result = await createQuickJob(body as { time?: unknown; prompt?: unknown });
          if (opts.onJobsChanged) await opts.onJobsChanged();
          return json({ ok: true, ...result });
        } catch (err) {
          return json({ ok: false, error: String(err) });
        }
      }

      if (url.pathname.startsWith("/api/jobs/") && req.method === "DELETE") {
        try {
          const encodedName = url.pathname.slice("/api/jobs/".length);
          const name = decodeURIComponent(encodedName);
          await deleteJob(name);
          if (opts.onJobsChanged) await opts.onJobsChanged();
          return json({ ok: true });
        } catch (err) {
          return json({ ok: false, error: String(err) });
        }
      }

      if (url.pathname === "/api/jobs") {
        const jobs = opts.getSnapshot().jobs.map((j) => ({
          name: j.name,
          schedule: j.schedule,
          promptPreview: j.prompt.slice(0, 160),
        }));
        return json({ jobs });
      }

      if (url.pathname === "/api/logs") {
        const tail = clampInt(url.searchParams.get("tail"), 200, 20, 2000);
        return json(await readLogs(tail));
      }

      // ── Conversations API ──
      if (url.pathname === "/api/conversations" && req.method === "GET") {
        return json({ ok: true, conversations: await listChats() });
      }

      if (url.pathname === "/api/conversations" && req.method === "POST") {
        const conv = await createChat();
        return json({ ok: true, conversation: conv });
      }

      if (url.pathname.startsWith("/api/conversations/") && req.method === "GET") {
        const id = url.pathname.slice("/api/conversations/".length);
        const conv = await getChat(id);
        if (!conv) return new Response(JSON.stringify({ ok: false, error: "not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
        return json({ ok: true, conversation: conv });
      }

      if (url.pathname.startsWith("/api/conversations/") && req.method === "DELETE") {
        const id = url.pathname.slice("/api/conversations/".length);
        await deleteChat(id);
        return json({ ok: true });
      }

      // ── Image upload ──
      if (url.pathname === "/api/upload" && req.method === "POST") {
        try {
          const formData = await req.formData();
          const file = formData.get("image") as File | null;
          if (!file) return json({ ok: false, error: "no image" });

          const uploadsDir = require("path").join(process.cwd(), ".claude", "claudeclaw", "uploads");
          await require("fs/promises").mkdir(uploadsDir, { recursive: true });

          const ext = file.name?.split(".").pop() || "png";
          const name = `img_${Date.now().toString(36)}.${ext}`;
          const filePath = require("path").join(uploadsDir, name);
          const buf = await file.arrayBuffer();
          await Bun.write(filePath, buf);

          return json({ ok: true, path: filePath, name });
        } catch (err) {
          return json({ ok: false, error: String(err) });
        }
      }

      // ── Chat (with conversation binding) ──
      if (url.pathname === "/api/chat" && req.method === "POST") {
        if (!opts.onChat) return json({ ok: false, error: "chat not configured" });
        try {
          const body = await req.json();
          const message = String(body?.message ?? "").trim();
          const conversationId = String(body?.conversationId ?? "").trim();
          if (!message) return json({ ok: false, error: "message required" });

          // Save user message to conversation
          if (conversationId) {
            await appendMessage(conversationId, "user", message);
          }

          // Detect user corrections and save as lessons
          try {
            const { isCorrection, extractCorrection, saveLesson } = await import("../lessons");
            if (conversationId && isCorrection(message)) {
              const conv = await getChat(conversationId);
              if (conv && conv.messages.length >= 1) {
                const lastAssistant = [...conv.messages].reverse().find(m => m.role === "assistant");
                if (lastAssistant) {
                  const correction = extractCorrection(message, lastAssistant.text);
                  if (correction) {
                    await saveLesson({
                      category: "correction",
                      trigger: correction.trigger,
                      lesson: correction.lesson,
                      context: "chat",
                      confidence: 2,
                    });
                  }
                }
              }
            }
          } catch {}

          const encoder = new TextEncoder();
          const onChat = opts.onChat;
          let fullResponse = "";
          const stream = new ReadableStream({
            async start(controller) {
              const send = (data: object) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
              };
              try {
                await onChat(
                  message,
                  (chunk) => {
                    fullResponse += chunk;
                    send({ type: "chunk", text: chunk });
                  },
                  () => send({ type: "unblock" })
                );
                // Save assistant response to conversation
                if (conversationId && fullResponse) {
                  const updated = await appendMessage(conversationId, "assistant", fullResponse);
                  // Capture session ID if conversation doesn't have one yet
                  if (updated && !updated.sessionId) {
                    try {
                      const sessionFile = Bun.file(
                        require("path").join(process.cwd(), ".claude", "claudeclaw", "session.json")
                      );
                      const session = await sessionFile.json();
                      if (session?.sessionId) {
                        await setChatSessionId(conversationId, session.sessionId);
                      }
                    } catch {}
                  }
                }
                send({ type: "done" });
              } catch (err) {
                if (conversationId && fullResponse) {
                  await appendMessage(conversationId, "assistant", fullResponse + "\n\n[\u9519\u8bef: " + String(err) + "]");
                }
                send({ type: "error", message: String(err) });
              } finally {
                controller.close();
              }
            },
          });

          return new Response(stream, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              "Connection": "keep-alive",
              "X-Accel-Buffering": "no",
            },
          });
        } catch (err) {
          return json({ ok: false, error: String(err) });
        }
      }

      // ── Migration endpoint (localStorage → server) ──
      if (url.pathname === "/api/conversations/migrate" && req.method === "POST") {
        try {
          const body = await req.json();
          const messages = body?.messages as Array<{ role: string; text: string }> | undefined;
          if (!Array.isArray(messages) || messages.length === 0) {
            return json({ ok: false, error: "no messages to migrate" });
          }
          const conv = await createChat();
          for (const msg of messages) {
            if (msg.role === "user" || msg.role === "assistant") {
              conv.messages.push({ role: msg.role, text: String(msg.text ?? "") });
            }
          }
          // Set title from first user message
          const firstUser = conv.messages.find((m) => m.role === "user");
          if (firstUser) {
            conv.title = firstUser.text.slice(0, 30) + (firstUser.text.length > 30 ? "..." : "");
          }
          const { saveChat: saveChatFn } = await import("./services/chats");
          await saveChatFn(conv);
          return json({ ok: true, conversation: { id: conv.id, title: conv.title } });
        } catch (err) {
          return json({ ok: false, error: String(err) });
        }
      }

      // ── Webhooks 管理 API ──
      if (url.pathname === "/api/webhooks" && req.method === "GET") {
        try {
          return json({ ok: true, webhooks: await listWebhooks() });
        } catch (err) {
          return json({ ok: false, error: String(err) });
        }
      }

      if (url.pathname === "/api/webhooks" && req.method === "POST") {
        try {
          const body = await req.json();
          const name = String(body?.name ?? "").trim();
          const prompt = String(body?.prompt ?? "").trim();
          const secret = body?.secret ? String(body.secret).trim() : undefined;
          if (!name) return json({ ok: false, error: "缺少 name 字段" });
          if (!prompt) return json({ ok: false, error: "缺少 prompt 字段" });
          const webhook = await saveWebhook(name, prompt, secret);
          return json({ ok: true, webhook });
        } catch (err) {
          return json({ ok: false, error: String(err) });
        }
      }

      if (url.pathname.startsWith("/api/webhooks/") && req.method === "DELETE") {
        try {
          const encodedName = url.pathname.slice("/api/webhooks/".length);
          const name = decodeURIComponent(encodedName);
          await deleteWebhook(name);
          return json({ ok: true });
        } catch (err) {
          return json({ ok: false, error: String(err) });
        }
      }

      // ── Webhook 触发端点 ──
      if (url.pathname.startsWith("/api/webhook/") && req.method === "POST") {
        try {
          const encodedName = url.pathname.slice("/api/webhook/".length);
          const name = decodeURIComponent(encodedName);
          const webhook = await getWebhook(name);
          if (!webhook) {
            return new Response(JSON.stringify({ ok: false, error: "未找到该 webhook" }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }

          if (webhook.secret) {
            const headerSecret = req.headers.get("X-Webhook-Secret");
            if (headerSecret !== webhook.secret) {
              return new Response(JSON.stringify({ ok: false, error: "密钥验证失败" }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
              });
            }
          }

          if (!opts.onChat) {
            return json({ ok: false, error: "聊天功能未配置" });
          }

          const bodyText = await req.text();
          const resolvedPrompt = webhook.prompt.replace(/\{\{body\}\}/g, bodyText);

          opts.onChat(resolvedPrompt, () => {}, () => {}).catch((err) =>
            console.error(`[Webhook] ${name} 执行出错:`, err)
          );

          return json({ ok: true, message: "webhook 已触发" });
        } catch (err) {
          return json({ ok: false, error: String(err) });
        }
      }

      // ── Memory API ──
      if (url.pathname === "/api/memory/search" && req.method === "GET") {
        try {
          const q = url.searchParams.get("q") ?? "";
          if (!q) return json({ ok: false, error: "缺少搜索关键词参数 q" });
          const results = await searchMemories(q);
          return json({ ok: true, results });
        } catch (err) {
          return json({ ok: false, error: String(err) });
        }
      }

      if (url.pathname === "/api/memory" && req.method === "GET") {
        try {
          const memories = await listMemories();
          return json({ ok: true, memories });
        } catch (err) {
          return json({ ok: false, error: String(err) });
        }
      }

      if (url.pathname.startsWith("/api/memory/") && req.method === "GET") {
        try {
          const key = decodeURIComponent(url.pathname.slice("/api/memory/".length));
          const content = await getMemory(key);
          if (content === null) return json({ ok: false, error: "记忆条目未找到" });
          return json({ ok: true, key, content });
        } catch (err) {
          return json({ ok: false, error: String(err) });
        }
      }

      if (url.pathname.startsWith("/api/memory/") && req.method === "POST") {
        try {
          const key = decodeURIComponent(url.pathname.slice("/api/memory/".length));
          const body = await req.json();
          const content = String(body?.content ?? "");
          if (!content.trim()) return json({ ok: false, error: "记忆内容不能为空" });
          await saveMemory(key, content);
          return json({ ok: true, key });
        } catch (err) {
          return json({ ok: false, error: String(err) });
        }
      }

      if (url.pathname.startsWith("/api/memory/") && req.method === "DELETE") {
        try {
          const key = decodeURIComponent(url.pathname.slice("/api/memory/".length));
          await deleteMemory(key);
          return json({ ok: true });
        } catch (err) {
          return json({ ok: false, error: String(err) });
        }
      }

      // ── Job Health API ──
      if (url.pathname === "/api/job-health" && req.method === "GET") {
        try {
          await loadHealth();
          return json({ ok: true, health: await getAllHealth() });
        } catch (err) {
          return json({ ok: false, error: String(err) });
        }
      }

      if (url.pathname.startsWith("/api/job-health/") && url.pathname.endsWith("/reset") && req.method === "POST") {
        try {
          const middle = url.pathname.slice("/api/job-health/".length, -"/reset".length);
          const name = decodeURIComponent(middle);
          await loadHealth();
          await resetJobHealth(name);
          return json({ ok: true });
        } catch (err) {
          return json({ ok: false, error: String(err) });
        }
      }

      // ── Pairing API ──
      if (url.pathname === "/api/pairing/verify" && req.method === "POST") {
        try {
          const body = await req.json();
          const code = String(body?.code ?? "").trim();
          if (!code) return json({ ok: false, error: "缺少配对码" });

          const pairing = await verifyPairing(code);
          if (!pairing) {
            return json({ ok: false, error: "配对码无效或已过期" });
          }

          // Add userId to telegram.allowedUserIds in settings.json
          const raw = await readFile(SETTINGS_FILE, "utf-8");
          const data = JSON.parse(raw) as Record<string, any>;
          if (!data.telegram) data.telegram = {};
          if (!Array.isArray(data.telegram.allowedUserIds)) {
            data.telegram.allowedUserIds = [];
          }
          if (!data.telegram.allowedUserIds.includes(pairing.userId)) {
            data.telegram.allowedUserIds.push(pairing.userId);
          }
          await writeFile(SETTINGS_FILE, JSON.stringify(data, null, 2) + "\n");

          return json({ ok: true, userId: pairing.userId, username: pairing.username });
        } catch (err) {
          return json({ ok: false, error: String(err) });
        }
      }

      if (url.pathname === "/api/pairing/pending" && req.method === "GET") {
        try {
          const pairings = await listPending();
          return json({ ok: true, pairings });
        } catch (err) {
          return json({ ok: false, error: String(err) });
        }
      }

      // ── Patterns / Self-Evolution API ──
      if (url.pathname === "/api/patterns" && req.method === "GET") {
        try {
          const { detectPatterns } = await import("../patterns");
          const patterns = await detectPatterns();
          return json({ ok: true, patterns });
        } catch (err) {
          return json({ ok: false, error: String(err) });
        }
      }

      if (url.pathname === "/api/patterns/stats" && req.method === "GET") {
        try {
          const { getUsageStats } = await import("../patterns");
          const stats = await getUsageStats();
          return json({ ok: true, stats });
        } catch (err) {
          return json({ ok: false, error: String(err) });
        }
      }

      if (url.pathname === "/api/patterns/skills" && req.method === "GET") {
        try {
          const { listLearnedSkills } = await import("../patterns");
          const skills = await listLearnedSkills();
          return json({ ok: true, skills });
        } catch (err) {
          return json({ ok: false, error: String(err) });
        }
      }

      if (url.pathname === "/api/patterns/generate" && req.method === "POST") {
        try {
          const body = await req.json();
          const patternId = String(body?.patternId ?? "").trim();
          if (!patternId) return json({ ok: false, error: "缺少 patternId 参数" });

          const { detectPatterns, generateSkill } = await import("../patterns");
          const patterns = await detectPatterns();
          const pattern = patterns.find(p => p.id === patternId);
          if (!pattern) return json({ ok: false, error: "未找到该模式" });

          const skillPath = await generateSkill(pattern);
          return json({ ok: true, skillPath, pattern });
        } catch (err) {
          return json({ ok: false, error: String(err) });
        }
      }

      // ── Analytics API ──
      if (url.pathname === "/api/analytics" && req.method === "GET") {
        try {
          return json(await buildAnalytics());
        } catch (err) {
          return json({ ok: false, error: String(err) });
        }
      }

      // ── Tools / Plugin Discovery API ──
      if (url.pathname === "/api/tools" && req.method === "GET") {
        try {
          const { discoverTools } = await import("../tools");
          const tools = await discoverTools();
          return json({ ok: true, tools });
        } catch (err) {
          return json({ ok: false, error: String(err) });
        }
      }

      // ── Lessons / Error Learning API ──
      if (url.pathname === "/api/lessons/stats" && req.method === "GET") {
        try {
          const { getLearningStats } = await import("../lessons");
          const stats = await getLearningStats();
          return json({ ok: true, stats });
        } catch (err) {
          return json({ ok: false, error: String(err) });
        }
      }

      if (url.pathname === "/api/lessons" && req.method === "GET") {
        try {
          const { getLessons } = await import("../lessons");
          const lessons = await getLessons();
          return json({ ok: true, lessons });
        } catch (err) {
          return json({ ok: false, error: String(err) });
        }
      }

      if (url.pathname === "/api/lessons" && req.method === "POST") {
        try {
          const { saveLesson } = await import("../lessons");
          const body = await req.json();
          const category = String(body?.category ?? "rule").trim();
          const trigger = String(body?.trigger ?? "").trim();
          const lesson = String(body?.lesson ?? "").trim();
          const confidence = Number(body?.confidence ?? 2);
          if (!trigger) return json({ ok: false, error: "缺少 trigger 字段" });
          if (!lesson) return json({ ok: false, error: "缺少 lesson 字段" });
          const saved = await saveLesson({
            category: category as "error" | "correction" | "preference" | "rule",
            trigger,
            lesson,
            context: "manual",
            confidence: Math.max(1, Math.min(5, confidence)),
          });
          return json({ ok: true, lesson: saved });
        } catch (err) {
          return json({ ok: false, error: String(err) });
        }
      }

      if (url.pathname.match(/^\/api\/lessons\/[^/]+\/reinforce$/) && req.method === "POST") {
        try {
          const { reinforceLesson } = await import("../lessons");
          const id = url.pathname.slice("/api/lessons/".length, -"/reinforce".length);
          await reinforceLesson(decodeURIComponent(id));
          return json({ ok: true });
        } catch (err) {
          return json({ ok: false, error: String(err) });
        }
      }

      if (url.pathname.startsWith("/api/lessons/") && req.method === "DELETE") {
        try {
          const { deleteLesson } = await import("../lessons");
          const id = url.pathname.slice("/api/lessons/".length);
          await deleteLesson(decodeURIComponent(id));
          return json({ ok: true });
        } catch (err) {
          return json({ ok: false, error: String(err) });
        }
      }

      return new Response("Not found", { status: 404 });
    },
  });

  return {
    stop: () => server.stop(),
    host: opts.host,
    port: server.port,
  };
}
