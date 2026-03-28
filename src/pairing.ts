import { join } from "path";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";

const CLAUDECLAW_DIR = join(process.cwd(), ".claude", "claudeclaw");
const PAIRING_FILE = join(CLAUDECLAW_DIR, "pending_pairings.json");

const EXPIRY_MINUTES = 10;

export interface PendingPairing {
  userId: number;
  username: string;
  code: string;
  chatId: number;
  createdAt: string;
  expiresAt: string;
}

let pendingPairings: PendingPairing[] = [];

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function loadFromFile(): Promise<void> {
  try {
    if (existsSync(PAIRING_FILE)) {
      const raw = await readFile(PAIRING_FILE, "utf-8");
      pendingPairings = JSON.parse(raw);
    }
  } catch {
    pendingPairings = [];
  }
}

async function saveToFile(): Promise<void> {
  await mkdir(CLAUDECLAW_DIR, { recursive: true });
  await writeFile(PAIRING_FILE, JSON.stringify(pendingPairings, null, 2) + "\n");
}

export async function cleanExpired(): Promise<void> {
  await loadFromFile();
  const now = Date.now();
  pendingPairings = pendingPairings.filter(
    (p) => new Date(p.expiresAt).getTime() > now
  );
  await saveToFile();
}

export async function createPairing(
  userId: number,
  username: string,
  chatId: number
): Promise<string> {
  await cleanExpired();

  // Remove any existing pairing for this user
  pendingPairings = pendingPairings.filter((p) => p.userId !== userId);

  const code = generateCode();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + EXPIRY_MINUTES * 60 * 1000);

  pendingPairings.push({
    userId,
    username,
    code,
    chatId,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });

  await saveToFile();
  return code;
}

export async function verifyPairing(code: string): Promise<PendingPairing | null> {
  await loadFromFile();
  const now = Date.now();
  const index = pendingPairings.findIndex(
    (p) => p.code === code && new Date(p.expiresAt).getTime() > now
  );
  if (index === -1) return null;

  const pairing = pendingPairings[index];
  // Remove the used pairing
  pendingPairings.splice(index, 1);
  await saveToFile();
  return pairing;
}

export async function listPending(): Promise<PendingPairing[]> {
  await loadFromFile();
  const now = Date.now();
  return pendingPairings.filter(
    (p) => new Date(p.expiresAt).getTime() > now
  );
}
