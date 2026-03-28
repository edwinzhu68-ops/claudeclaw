import { join } from "path";
import { mkdir, readdir, unlink } from "fs/promises";

const CHATS_DIR = join(process.cwd(), ".claude", "claudeclaw", "chats");

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export interface ChatConversation {
  id: string;
  title: string;
  sessionId: string | null;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface ChatListItem {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
}

async function ensureDir(): Promise<void> {
  await mkdir(CHATS_DIR, { recursive: true });
}

function chatPath(id: string): string {
  return join(CHATS_DIR, `${id}.json`);
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export async function listChats(): Promise<ChatListItem[]> {
  await ensureDir();
  let files: string[];
  try {
    files = await readdir(CHATS_DIR);
  } catch {
    return [];
  }
  const items: ChatListItem[] = [];
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    try {
      const chat: ChatConversation = await Bun.file(join(CHATS_DIR, f)).json();
      items.push({
        id: chat.id,
        title: chat.title,
        updatedAt: chat.updatedAt,
        messageCount: chat.messages.length,
      });
    } catch {
      // skip corrupt files
    }
  }
  items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return items;
}

export async function getChat(id: string): Promise<ChatConversation | null> {
  try {
    return await Bun.file(chatPath(id)).json();
  } catch {
    return null;
  }
}

export async function createChat(): Promise<ChatConversation> {
  await ensureDir();
  const now = new Date().toISOString();
  const chat: ChatConversation = {
    id: generateId(),
    title: "\u65b0\u5bf9\u8bdd",
    sessionId: null,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
  await Bun.write(chatPath(chat.id), JSON.stringify(chat, null, 2) + "\n");
  return chat;
}

export async function saveChat(chat: ChatConversation): Promise<void> {
  await ensureDir();
  chat.updatedAt = new Date().toISOString();
  await Bun.write(chatPath(chat.id), JSON.stringify(chat, null, 2) + "\n");
}

export async function deleteChat(id: string): Promise<void> {
  try {
    await unlink(chatPath(id));
  } catch {
    // already gone
  }
}

export async function appendMessage(
  id: string,
  role: "user" | "assistant",
  text: string
): Promise<ChatConversation | null> {
  const chat = await getChat(id);
  if (!chat) return null;
  chat.messages.push({ role, text });
  // Auto-set title from first user message
  if (chat.title === "\u65b0\u5bf9\u8bdd" && role === "user") {
    chat.title = text.slice(0, 30) + (text.length > 30 ? "..." : "");
  }
  await saveChat(chat);
  return chat;
}

export async function setChatSessionId(
  id: string,
  sessionId: string
): Promise<void> {
  const chat = await getChat(id);
  if (!chat) return;
  chat.sessionId = sessionId;
  await saveChat(chat);
}
