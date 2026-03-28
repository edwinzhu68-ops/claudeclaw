import { join } from "path";
import { mkdir, readdir, readFile, writeFile } from "fs/promises";

const LESSONS_DIR = join(process.cwd(), ".claude", "claudeclaw", "lessons");

export interface Lesson {
  id: string;
  category: "error" | "correction" | "preference" | "rule";
  trigger: string;      // What went wrong / what prompted the lesson
  lesson: string;       // What to do differently
  context: string;      // Source context (e.g., "telegram", "chat", filename)
  confidence: number;   // 1-5, increases when same lesson is reinforced
  createdAt: string;
  reinforcedAt: string; // Last time this lesson was confirmed
  appliedCount: number; // How many times this was injected
}

async function ensureDir(): Promise<void> {
  await mkdir(LESSONS_DIR, { recursive: true });
}

function lessonPath(id: string): string {
  return join(LESSONS_DIR, `${id}.json`);
}

// Save a new lesson
export async function saveLesson(lesson: Omit<Lesson, "id" | "createdAt" | "reinforcedAt" | "appliedCount">): Promise<Lesson> {
  await ensureDir();
  const full: Lesson = {
    ...lesson,
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    createdAt: new Date().toISOString(),
    reinforcedAt: new Date().toISOString(),
    appliedCount: 0,
  };
  await writeFile(lessonPath(full.id), JSON.stringify(full, null, 2));
  return full;
}

// Get all lessons sorted by confidence desc
export async function getLessons(): Promise<Lesson[]> {
  await ensureDir();
  const lessons: Lesson[] = [];
  try {
    const files = (await readdir(LESSONS_DIR)).filter(f => f.endsWith(".json"));
    for (const f of files) {
      try {
        const data: Lesson = JSON.parse(await readFile(join(LESSONS_DIR, f), "utf-8"));
        lessons.push(data);
      } catch {}
    }
  } catch {}
  return lessons.sort((a, b) => b.confidence - a.confidence);
}

// Reinforce a lesson (increase confidence)
export async function reinforceLesson(id: string): Promise<void> {
  try {
    const path = lessonPath(id);
    const data: Lesson = JSON.parse(await readFile(path, "utf-8"));
    data.confidence = Math.min(5, data.confidence + 1);
    data.reinforcedAt = new Date().toISOString();
    await writeFile(path, JSON.stringify(data, null, 2));
  } catch {}
}

// Mark lesson as applied
export async function markApplied(id: string): Promise<void> {
  try {
    const path = lessonPath(id);
    const data: Lesson = JSON.parse(await readFile(path, "utf-8"));
    data.appliedCount++;
    await writeFile(path, JSON.stringify(data, null, 2));
  } catch {}
}

// Delete a lesson
export async function deleteLesson(id: string): Promise<void> {
  try {
    const { unlink } = await import("fs/promises");
    await unlink(lessonPath(id));
  } catch {}
}

// Detect if a user message contains a correction signal
export function isCorrection(text: string): boolean {
  const correctionPatterns = [
    /不对/,  /错了/,  /错误/,  /改成/,  /应该是/,  /修改/,  /改正/,
    /bug/i,  /fix/i,  /wrong/i,  /incorrect/i,  /mistake/i,
    /不是这样/,  /不应该/,  /问题是/,  /出错/,  /搞错/,
    /重新/,  /再.*一次/,  /换.*方式/,  /不要.*这样/,
  ];
  return correctionPatterns.some(p => p.test(text));
}

// Extract the correction lesson from a user message
// Returns { trigger, lesson } or null
export function extractCorrection(userMsg: string, previousResponse: string): { trigger: string; lesson: string } | null {
  // Trim to reasonable lengths
  const trigger = previousResponse.slice(0, 200).replace(/\n/g, " ").trim();
  const lesson = userMsg.slice(0, 300).trim();

  if (!trigger || !lesson) return null;
  return { trigger, lesson };
}

// Build lessons context for injection into system prompt
// Only inject high-confidence lessons relevant to current prompt
export async function buildLessonsContext(currentPrompt: string, maxLessons: number = 8): Promise<string> {
  const lessons = await getLessons();
  if (lessons.length === 0) return "";

  const promptLower = currentPrompt.toLowerCase();
  const promptWords = promptLower.split(/\s+/).filter(w => w.length > 2);

  // Score lessons by relevance
  const scored = lessons.map(l => {
    let score = l.confidence; // Base score from confidence

    // Word overlap with trigger and lesson text
    const combined = (l.trigger + " " + l.lesson).toLowerCase();
    for (const word of promptWords) {
      if (combined.includes(word)) score += 1;
    }

    // Recency boost
    const ageMs = Date.now() - new Date(l.reinforcedAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays < 1) score += 2;
    else if (ageDays < 7) score += 1;

    return { ...l, score };
  });

  scored.sort((a, b) => b.score - a.score);
  // Lessons with confidence >= 4 should always be injected regardless of relevance score
  const selected = scored.slice(0, maxLessons).filter(l => l.score >= 2 || l.confidence >= 4);

  if (selected.length === 0) return "";

  // Mark as applied
  for (const l of selected) {
    await markApplied(l.id);
  }

  const lines = selected.map(l =>
    `- [${l.category}] 触发: "${l.trigger.slice(0, 60)}..." → 教训: "${l.lesson.slice(0, 100)}..." (置信度: ${l.confidence}/5)`
  );

  return `## 经验教训 (${selected.length} 条)\n\n以下是从过去的错误中学到的教训，请避免重犯：\n\n${lines.join("\n")}`;
}

// Get stats about the learning system
export async function getLearningStats(): Promise<{
  totalLessons: number;
  byCategory: Record<string, number>;
  avgConfidence: number;
  totalApplied: number;
}> {
  const lessons = await getLessons();
  const byCategory: Record<string, number> = {};
  let totalApplied = 0;
  let totalConf = 0;

  for (const l of lessons) {
    byCategory[l.category] = (byCategory[l.category] || 0) + 1;
    totalApplied += l.appliedCount;
    totalConf += l.confidence;
  }

  return {
    totalLessons: lessons.length,
    byCategory,
    avgConfidence: lessons.length > 0 ? Math.round((totalConf / lessons.length) * 10) / 10 : 0,
    totalApplied,
  };
}
