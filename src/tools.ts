import { join } from "path";
import { readdir, readFile, stat } from "fs/promises";
import { existsSync } from "fs";

const PLUGINS_DIR = join(process.env.HOME || "~", ".claude", "plugins", "marketplaces");
const SETTINGS_FILE = join(process.env.HOME || "~", ".claude", "settings.json");

export interface DiscoveredTool {
  name: string;
  type: "plugin" | "mcp" | "skill";
  source: string;       // marketplace name or "settings"
  description: string;
  available: boolean;
}

// Cache with 60-second TTL
let cachedTools: DiscoveredTool[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000;

function isCacheValid(): boolean {
  return cachedTools !== null && Date.now() - cacheTimestamp < CACHE_TTL_MS;
}

/**
 * Scan installed plugins and MCP servers.
 * Results are cached for 60 seconds to avoid repeated filesystem scans.
 */
export async function discoverTools(): Promise<DiscoveredTool[]> {
  if (isCacheValid()) return cachedTools!;

  const tools: DiscoveredTool[] = [];

  // 1. Scan plugin marketplaces
  try {
    const marketplaces = await readdir(PLUGINS_DIR);
    for (const mp of marketplaces) {
      const mpPath = join(PLUGINS_DIR, mp);
      const mpStat = await stat(mpPath).catch(() => null);
      if (!mpStat?.isDirectory()) continue;

      // Try to read CLAUDE.md or README.md for description
      let description = "";
      for (const descFile of ["CLAUDE.md", "README.md"]) {
        const descPath = join(mpPath, descFile);
        if (existsSync(descPath)) {
          try {
            const content = await readFile(descPath, "utf-8");
            // Extract first meaningful line
            const lines = content.split("\n").filter(l => l.trim() && !l.startsWith("#"));
            description = (lines[0] || "").slice(0, 100);
          } catch {}
          break;
        }
      }

      tools.push({
        name: mp,
        type: "plugin",
        source: mp,
        description: description || `已安装的插件: ${mp}`,
        available: true,
      });
    }
  } catch {}

  // 2. Scan MCP servers from settings
  try {
    if (existsSync(SETTINGS_FILE)) {
      const settings = JSON.parse(await readFile(SETTINGS_FILE, "utf-8"));

      // Check permissions for MCP tools
      const allowed = settings?.permissions?.allow || [];
      const mcpTools = allowed.filter((p: string) => p.startsWith("mcp__"));

      for (const mcp of mcpTools) {
        const name = mcp.replace("mcp__", "");
        tools.push({
          name,
          type: "mcp",
          source: "settings",
          description: `MCP 服务: ${name}`,
          available: true,
        });
      }

      // Check mcpServers config
      const mcpServers = settings?.mcpServers || {};
      for (const [name, _config] of Object.entries(mcpServers)) {
        if (!tools.some(t => t.name === name)) {
          tools.push({
            name,
            type: "mcp",
            source: "settings.mcpServers",
            description: `MCP 服务: ${name}`,
            available: true,
          });
        }
      }
    }
  } catch {}

  // 3. Scan official external plugins
  const officialDir = join(PLUGINS_DIR, "claude-plugins-official", "external_plugins");
  try {
    if (existsSync(officialDir)) {
      const plugins = await readdir(officialDir);
      for (const p of plugins) {
        if (!tools.some(t => t.name === p)) {
          tools.push({
            name: p,
            type: "plugin",
            source: "claude-plugins-official",
            description: `官方插件: ${p}`,
            available: true,
          });
        }
      }
    }
  } catch {}

  // Update cache
  cachedTools = tools;
  cacheTimestamp = Date.now();

  return tools;
}

/** Invalidate the tool discovery cache (e.g. after settings change). */
export function invalidateToolCache(): void {
  cachedTools = null;
  cacheTimestamp = 0;
}

/**
 * Build a tools context string for injection into Claude's system prompt.
 * Lists available tools so Claude knows what it can use.
 */
export async function buildToolsContext(): Promise<string> {
  try {
    const tools = await discoverTools();
    if (tools.length === 0) return "";

    const plugins = tools.filter(t => t.type === "plugin");
    const mcps = tools.filter(t => t.type === "mcp");

    const parts: string[] = ["## 可用工具和插件\n"];

    if (mcps.length > 0) {
      parts.push("### MCP 服务");
      for (const t of mcps) {
        parts.push(`- **${t.name}**: ${t.description}`);
      }
      parts.push("");
    }

    if (plugins.length > 0) {
      parts.push("### 已安装插件");
      for (const t of plugins) {
        parts.push(`- **${t.name}**: ${t.description}`);
      }
      parts.push("");
    }

    parts.push("你可以利用这些工具来完成用户的请求。");

    return parts.join("\n");
  } catch {
    return "";
  }
}
