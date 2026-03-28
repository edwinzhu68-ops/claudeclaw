import { join } from "path";
import { readdir, stat } from "fs/promises";

const LOGS_DIR = join(process.cwd(), ".claude", "claudeclaw", "logs");
const MEMORY_DIR = join(process.cwd(), ".claude", "claudeclaw", "memory");

export interface DailyCount {
  date: string; // YYYY-MM-DD
  count: number;
}

export interface AnalyticsData {
  dailyCounts: DailyCount[]; // Last 7 days
  sourceBreakdown: Record<string, number>; // telegram: 5, chat: 10, etc.
  totalSessions: number;
  memoryCount: number;
  logCount: number;
}

export async function buildAnalytics(): Promise<AnalyticsData> {
  const dailyCounts: Map<string, number> = new Map();
  const sourceBreakdown: Record<string, number> = {};
  let logCount = 0;

  // Initialize last 7 days
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dailyCounts.set(d.toISOString().slice(0, 10), 0);
  }

  // Scan log files
  try {
    const files = await readdir(LOGS_DIR);
    logCount = files.length;

    for (const f of files) {
      if (!f.endsWith(".log")) continue;

      try {
        // Parse filename: {source}-{timestamp}.log
        const dashIdx = f.indexOf("-");
        if (dashIdx === -1) continue;
        const source = f.slice(0, dashIdx);
        sourceBreakdown[source] = (sourceBreakdown[source] || 0) + 1;

        // Get file date from the stat
        const fileStat = await stat(join(LOGS_DIR, f));
        const date = fileStat.mtime.toISOString().slice(0, 10);
        if (dailyCounts.has(date)) {
          dailyCounts.set(date, (dailyCounts.get(date) || 0) + 1);
        }
      } catch {}
    }
  } catch {}

  // Count memories
  let memoryCount = 0;
  try {
    const memFiles = await readdir(MEMORY_DIR);
    memoryCount = memFiles.filter((f) => f.endsWith(".md")).length;
  } catch {}

  return {
    dailyCounts: [...dailyCounts.entries()].map(([date, count]) => ({ date, count })),
    sourceBreakdown,
    totalSessions: logCount,
    memoryCount,
    logCount,
  };
}
