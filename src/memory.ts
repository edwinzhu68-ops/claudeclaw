import { join } from "path";
import { mkdir, readdir, readFile, writeFile, unlink, stat } from "fs/promises";

const MEMORY_DIR = join(process.cwd(), ".claude", "claudeclaw", "memory");

export interface MemoryEntry {
  key: string;
  content: string;
  updatedAt: string;
}

/** 确保记忆目录存在 */
export async function ensureMemoryDir(): Promise<void> {
  await mkdir(MEMORY_DIR, { recursive: true });
}

/** 列出所有记忆条目（键名 + 第一行预览 + 更新时间） */
export async function listMemories(): Promise<Array<{ key: string; preview: string; updatedAt: string }>> {
  await ensureMemoryDir();
  try {
    const files = await readdir(MEMORY_DIR);
    const entries: Array<{ key: string; preview: string; updatedAt: string }> = [];
    for (const file of files) {
      if (!file.endsWith(".md")) continue;
      const key = file.replace(/\.md$/, "");
      const filePath = join(MEMORY_DIR, file);
      try {
        const content = await readFile(filePath, "utf8");
        const firstLine = content.split("\n").find((l) => l.trim() !== "") ?? "";
        const fileStat = await stat(filePath);
        entries.push({
          key,
          preview: firstLine.slice(0, 120),
          updatedAt: fileStat.mtime.toISOString(),
        });
      } catch {
        // 跳过无法读取的文件
      }
    }
    return entries;
  } catch {
    return [];
  }
}

/** 读取指定记忆 */
export async function getMemory(key: string): Promise<string | null> {
  await ensureMemoryDir();
  const filePath = join(MEMORY_DIR, `${key}.md`);
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

/** 保存或更新记忆 */
export async function saveMemory(key: string, content: string): Promise<void> {
  await ensureMemoryDir();
  const filePath = join(MEMORY_DIR, `${key}.md`);
  await writeFile(filePath, content, "utf8");
}

/** 删除记忆 */
export async function deleteMemory(key: string): Promise<void> {
  await ensureMemoryDir();
  const filePath = join(MEMORY_DIR, `${key}.md`);
  try {
    await unlink(filePath);
  } catch {
    // 文件不存在则忽略
  }
}

/** 搜索记忆（大小写不敏感） */
export async function searchMemories(query: string): Promise<Array<{ key: string; matches: string[] }>> {
  await ensureMemoryDir();
  const results: Array<{ key: string; matches: string[] }> = [];
  const lowerQuery = query.toLowerCase();
  try {
    const files = await readdir(MEMORY_DIR);
    for (const file of files) {
      if (!file.endsWith(".md")) continue;
      const key = file.replace(/\.md$/, "");
      const filePath = join(MEMORY_DIR, file);
      try {
        const content = await readFile(filePath, "utf8");
        const lines = content.split("\n");
        const matchingLines = lines.filter((line) => line.toLowerCase().includes(lowerQuery));
        if (matchingLines.length > 0) {
          results.push({ key, matches: matchingLines.slice(0, 5) });
        }
      } catch {
        // 跳过无法读取的文件
      }
    }
  } catch {
    // 目录不存在则返回空
  }
  return results;
}

/** 构建记忆上下文字符串，用于注入 Claude 系统提示 */
export async function buildMemoryContext(): Promise<string> {
  await ensureMemoryDir();
  try {
    const files = await readdir(MEMORY_DIR);
    const mdFiles = files.filter((f) => f.endsWith(".md")).sort();
    if (mdFiles.length === 0) return "";

    const sections: string[] = [];
    for (const file of mdFiles) {
      const key = file.replace(/\.md$/, "");
      const filePath = join(MEMORY_DIR, file);
      try {
        const content = await readFile(filePath, "utf8");
        if (content.trim()) {
          sections.push(`### ${key}\n${content.trim()}`);
        }
      } catch {
        // 跳过无法读取的文件
      }
    }

    if (sections.length === 0) return "";
    return `## 持久记忆\n\n${sections.join("\n\n")}`;
  } catch {
    return "";
  }
}

/**
 * Build memory context with relevance filtering.
 * Scores each memory against the current prompt and returns top-K.
 */
export async function buildSmartContext(currentPrompt: string, maxEntries: number = 10): Promise<string> {
  await ensureMemoryDir();

  let files: string[];
  try {
    files = (await readdir(MEMORY_DIR)).filter(f => f.endsWith(".md"));
  } catch {
    return "";
  }

  if (files.length === 0) return "";

  // Score each memory by relevance to current prompt
  const scored: Array<{ key: string; content: string; score: number; age: number }> = [];
  const now = Date.now();
  const promptLower = currentPrompt.toLowerCase();
  const promptWords = promptLower.split(/\s+/).filter(w => w.length > 2);

  for (const f of files) {
    const key = f.replace(/\.md$/, "");
    try {
      const fullPath = join(MEMORY_DIR, f);
      const content = await readFile(fullPath, "utf-8");
      const fileStat = await stat(fullPath);
      const ageMs = now - fileStat.mtimeMs;
      const ageDays = ageMs / (1000 * 60 * 60 * 24);

      // Relevance scoring
      let score = 0;
      const contentLower = content.toLowerCase();

      // Word overlap scoring
      for (const word of promptWords) {
        if (contentLower.includes(word)) score += 2;
      }

      // Category boost: preferences and facts always score higher
      if (key.startsWith("auto_preference")) score += 3;
      if (key.startsWith("auto_fact")) score += 2;
      if (key.startsWith("auto_decision")) score += 1;

      // Recency boost: newer memories score higher
      if (ageDays < 1) score += 3;       // Today
      else if (ageDays < 7) score += 2;   // This week
      else if (ageDays < 30) score += 1;  // This month
      // Older than 30 days: no boost (natural decay)

      // Penalize very old auto session summaries
      if (key.startsWith("session_") && ageDays > 7) score -= 2;

      scored.push({ key, content: content.trim(), score, age: ageDays });
    } catch {
      // skip unreadable files
    }
  }

  // Sort by score descending, take top maxEntries
  scored.sort((a, b) => b.score - a.score);
  const selected = scored.slice(0, maxEntries);

  if (selected.length === 0) return "";

  const parts = selected.map(m => `### ${m.key}\n${m.content}`);
  return `## 持久记忆 (${selected.length}/${files.length} 条相关)\n\n${parts.join("\n\n")}`;
}

/**
 * Remove auto-generated memories older than maxAgeDays.
 * Only prunes auto_ prefixed entries, never user-created ones.
 */
export async function pruneOldMemories(maxAgeDays: number = 30): Promise<number> {
  await ensureMemoryDir();
  let pruned = 0;

  try {
    const files = (await readdir(MEMORY_DIR)).filter(f => f.endsWith(".md"));
    const now = Date.now();

    for (const f of files) {
      const key = f.replace(/\.md$/, "");
      // Only prune auto-generated memories
      if (!key.startsWith("auto_") && !key.startsWith("session_")) continue;

      try {
        const fullPath = join(MEMORY_DIR, f);
        const fileStat = await stat(fullPath);
        const ageDays = (now - fileStat.mtimeMs) / (1000 * 60 * 60 * 24);

        if (ageDays > maxAgeDays) {
          await unlink(fullPath);
          pruned++;
        }
      } catch {
        // skip files that can't be stat'd or deleted
      }
    }
  } catch {
    // directory not readable
  }

  return pruned;
}
