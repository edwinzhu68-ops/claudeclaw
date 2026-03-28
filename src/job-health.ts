import { readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";

const HEALTH_FILE = join(process.cwd(), ".claude", "claudeclaw", "job_health.json");

interface JobHealthEntry {
  consecutiveFailures: number;
  lastFailure: string | null;
  lastSuccess: string | null;
  alertSentAt: string | null;
  totalRuns: number;
  totalFailures: number;
}

interface JobHealth {
  [jobName: string]: JobHealthEntry;
}

let health: JobHealth = {};

function defaultEntry(): JobHealthEntry {
  return {
    consecutiveFailures: 0,
    lastFailure: null,
    lastSuccess: null,
    alertSentAt: null,
    totalRuns: 0,
    totalFailures: 0,
  };
}

export async function loadHealth(): Promise<void> {
  try {
    const raw = await readFile(HEALTH_FILE, "utf-8");
    health = JSON.parse(raw);
  } catch {
    health = {};
  }
}

async function saveHealth(): Promise<void> {
  await mkdir(dirname(HEALTH_FILE), { recursive: true });
  await writeFile(HEALTH_FILE, JSON.stringify(health, null, 2) + "\n");
}

export async function recordSuccess(jobName: string): Promise<void> {
  if (!health[jobName]) health[jobName] = defaultEntry();
  const entry = health[jobName];
  entry.consecutiveFailures = 0;
  entry.lastSuccess = new Date().toISOString();
  entry.alertSentAt = null;
  entry.totalRuns++;
  await saveHealth();
}

export async function recordFailure(jobName: string, threshold: number = 3): Promise<boolean> {
  if (!health[jobName]) health[jobName] = defaultEntry();
  const entry = health[jobName];
  entry.consecutiveFailures++;
  entry.lastFailure = new Date().toISOString();
  entry.totalRuns++;
  entry.totalFailures++;
  await saveHealth();

  return entry.consecutiveFailures >= threshold && !entry.alertSentAt;
}

export async function getJobHealth(jobName: string): Promise<JobHealthEntry | null> {
  return health[jobName] ?? null;
}

export async function getAllHealth(): Promise<JobHealth> {
  return { ...health };
}

export async function markAlertSent(jobName: string): Promise<void> {
  if (!health[jobName]) return;
  health[jobName].alertSentAt = new Date().toISOString();
  await saveHealth();
}

export async function resetJobHealth(jobName: string): Promise<void> {
  delete health[jobName];
  await saveHealth();
}
