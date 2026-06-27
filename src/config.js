import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(projectRoot, ".env") });

function booleanValue(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
}

function numberValue(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid number env ${name}: ${raw}`);
  }
  return parsed;
}

export const config = {
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY?.trim() || "",
    baseUrl: process.env.DEEPSEEK_BASE_URL?.trim() || "https://api.deepseek.com",
    model: process.env.DEEPSEEK_MODEL?.trim() || "deepseek-v4-flash"
  },
  xianyu: {
    messagesUrl: process.env.XIANYU_MESSAGES_URL?.trim() || "https://www.goofish.com/im",
    pollIntervalMs: numberValue("POLL_INTERVAL_MS", 15000),
    autoSend: booleanValue("AUTO_SEND", false),
    maxHistoryMessages: numberValue("MAX_HISTORY_MESSAGES", 12),
    maxReplyChars: numberValue("MAX_REPLY_CHARS", 120),
    openConversationRetryCount: numberValue("OPEN_CONVERSATION_RETRY_COUNT", 8),
    openConversationRetryDelayMs: numberValue("OPEN_CONVERSATION_RETRY_DELAY_MS", 800)
  },
  browser: {
    executablePath: process.env.CHROME_EXECUTABLE_PATH?.trim() || undefined,
    userDataDir: process.env.CHROME_USER_DATA_DIR?.trim() || undefined,
    profile: process.env.CHROME_PROFILE?.trim() || "Default",
    headless: booleanValue("HEADLESS", false)
  },
  paths: {
    projectRoot,
    stateFile: path.join(projectRoot, "state.json"),
    heartbeatFile: path.join(projectRoot, "heartbeat.json"),
    logFile: path.join(projectRoot, "runtime.log"),
    debugHtmlFile: path.join(projectRoot, "debug-page.html"),
    debugJsonFile: path.join(projectRoot, "debug-selectors.json"),
    productConfigFile: path.join(projectRoot, "products.json")
  }
};

export function assertDeepSeekConfig() {
  if (!config.deepseek.apiKey) {
    throw new Error("Missing required env: DEEPSEEK_API_KEY");
  }
}
