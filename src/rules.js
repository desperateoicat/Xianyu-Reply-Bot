const HIGH_RISK_PATTERNS = [
  /退款/,
  /退货/,
  /投诉/,
  /差评/,
  /平台/,
  /处罚/,
  /封号/,
  /赔偿/,
  /维权/,
  /举报/,
  /微信/,
  /手机号/,
  /加我/,
  /线下交易/,
  /转账/,
  /地址/,
  /身份证/
];

const SYSTEM_CONVERSATION_PATTERNS = [
  /^通知消息$/,
  /^闲小蜜$/,
  /交易关闭/,
  /官方客服/,
  /系统消息/
];

export function assessConversation(conversation) {
  const title = conversation.title || "";
  if (SYSTEM_CONVERSATION_PATTERNS.some((pattern) => pattern.test(title))) {
    return { action: "skip", reason: `system conversation: ${title}` };
  }

  const latest = conversation.messages.at(-1);
  if (!latest) {
    return { action: "skip", reason: "empty conversation" };
  }

  if (latest.role !== "buyer") {
    return { action: "skip", reason: "latest message is not from buyer" };
  }

  const joined = conversation.messages.map((item) => item.text).join("\n");
  if (SYSTEM_CONVERSATION_PATTERNS.some((pattern) => pattern.test(joined))) {
    return { action: "skip", reason: "system content matched" };
  }
  // 仅对最新买家消息做风险匹配，避免历史消息永久阻塞后续回复
  const risk = HIGH_RISK_PATTERNS.find((pattern) => pattern.test(latest.text));
  if (risk) {
    return { action: "escalate", reason: `matched high-risk pattern: ${risk}` };
  }

  return { action: "reply" };
}

export function normalizeReply(text, maxChars) {
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) return "";
  return compact.slice(0, maxChars);
}
