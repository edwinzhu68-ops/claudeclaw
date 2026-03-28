import { join } from "path";
import { mkdir, readdir, readFile, writeFile, unlink } from "fs/promises";

const WEBHOOKS_DIR = join(process.cwd(), ".claude", "claudeclaw", "webhooks");

export interface WebhookConfig {
  name: string;
  prompt: string;
  secret?: string;
  createdAt: string;
}

export async function ensureWebhooksDir(): Promise<void> {
  await mkdir(WEBHOOKS_DIR, { recursive: true });
}

export async function listWebhooks(): Promise<WebhookConfig[]> {
  await ensureWebhooksDir();
  const files = await readdir(WEBHOOKS_DIR);
  const webhooks: WebhookConfig[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const content = await readFile(join(WEBHOOKS_DIR, file), "utf-8");
      webhooks.push(JSON.parse(content));
    } catch {}
  }
  return webhooks;
}

export async function getWebhook(name: string): Promise<WebhookConfig | null> {
  await ensureWebhooksDir();
  try {
    const content = await readFile(join(WEBHOOKS_DIR, `${name}.json`), "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export async function saveWebhook(name: string, prompt: string, secret?: string): Promise<WebhookConfig> {
  await ensureWebhooksDir();
  const config: WebhookConfig = {
    name,
    prompt,
    ...(secret ? { secret } : {}),
    createdAt: new Date().toISOString(),
  };
  await writeFile(join(WEBHOOKS_DIR, `${name}.json`), JSON.stringify(config, null, 2));
  return config;
}

export async function deleteWebhook(name: string): Promise<void> {
  await ensureWebhooksDir();
  await unlink(join(WEBHOOKS_DIR, `${name}.json`));
}
