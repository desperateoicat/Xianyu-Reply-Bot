import { chromium } from "playwright";

export const CONVERSATION_SELECTORS = [
  "#conv-list-scrollable .conversation-item--JReyg97P",
  "#conv-list-scrollable [class*='conversation-item--']",
  "#conv-list-scrollable .rc-virtual-list-holder-inner > div",
  "#conv-list-scrollable > div:not(.empty-container--Vp3wMU3E)",
  "#conv-list-scrollable [class*='conv-item']",
  "#conv-list-scrollable [class*='conversation-item']",
  "#conv-list-scrollable [class*='item']",
  "[data-testid='conversation-item']",
  ".conversation-item",
  ".session-item",
  ".im-chat-item",
  "[class*='session']"
];

export const MESSAGE_SELECTORS = [
  "#msg-list-container .ant-list-item",
  "#msg-list-container li.ant-list-item",
  ".message-row--pIWaXNhZ",
  "[class*='message-row']",
  ".message-content--kBUbolyy",
  "[class*='message-list'] [class*='message-item']",
  "[class*='chat-content'] [class*='message']",
  "main [class*='message']",
  "[data-testid='message-item']",
  ".message-item",
  ".msg-item",
  "[class*='message']"
];

export const INPUT_SELECTORS = [
  ".sendbox--A9eGQCY5 textarea",
  "[class*='sendbox'] textarea",
  "textarea[placeholder*='请输入消息']",
  "main textarea",
  "main [contenteditable='true']",
  "[class*='input'] textarea",
  "[class*='editor'] [contenteditable='true']",
  "textarea",
  "[contenteditable='true']",
  ".textarea",
  ".input-area textarea"
];

export const SEND_SELECTORS = [
  ".sendbox-bottom--O2c5fyIe button",
  "[class*='sendbox-bottom'] button",
  "button:has(span:text-is('发 送'))",
  "button:has-text('发 送')",
  "button[class*='send']",
  "[class*='send'] button",
  "button:has-text('发送')",
  "button:has-text('Send')",
  ".send-btn",
  "[data-testid='send-button']"
];

function textContent(locator) {
  return locator.textContent().then((text) => text?.trim() || "");
}

function compactWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function firstNumberFromText(value) {
  const match = value.match(/-?\d+(?:\.\d+)?/);
  return match ? match[0] : "";
}

export class XianyuPage {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.browserContext = null;
    this.page = null;
  }

  async start() {
    this.browserContext = await chromium.launchPersistentContext(
      this.config.userDataDir,
      {
        channel: this.config.executablePath ? undefined : "chrome",
        executablePath: this.config.executablePath,
        headless: this.config.headless,
        args: [`--profile-directory=${this.config.profile}`]
      }
    );

    this.page = this.browserContext.pages()[0] || await this.browserContext.newPage();
    await this.page.goto(this.config.messagesUrl, { waitUntil: "domcontentloaded" });
    this.logger.info("Opened Xianyu messages page");
  }

  async stop() {
    await this.browserContext?.close();
  }

  async listConversationCards() {
    const page = this.page;
    const maxAttempts = this.config.openConversationRetryCount ?? 8;
    const retryDelayMs = this.config.openConversationRetryDelayMs ?? 800;

    await page.waitForLoadState("domcontentloaded").catch(() => {});
    await page.locator("#conv-list-scrollable").first().waitFor({
      state: "attached",
      timeout: Math.max(5000, retryDelayMs * 2)
    }).catch(() => {});

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      await page.waitForTimeout(retryDelayMs);

      for (const selector of CONVERSATION_SELECTORS) {
        const count = await page.locator(selector).count();
        if (count > 0) {
          return page.locator(selector);
        }
      }

      const genericCards = page.locator("#conv-list-scrollable .rc-virtual-list-holder-inner > div");
      if ((await genericCards.count()) > 0) {
        return genericCards;
      }

      const emptyState = page.locator("#conv-list-scrollable .empty-container--Vp3wMU3E");
      if ((await emptyState.count()) > 0) {
        return page.locator("#conv-list-scrollable .empty-container--Vp3wMU3E");
      }
    }

    throw new Error("Could not find conversation list. Update selectors in src/xianyu-page.js");
  }

  async openLatestUnreadConversation() {
    let cards;
    try {
      cards = await this.listConversationCards();
    } catch {
      await this.page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
      await this.page.waitForTimeout(2500);
      cards = await this.listConversationCards();
    }
    const count = await cards.count();
    if (count === 0) return null;

    for (let i = 0; i < count; i += 1) {
      const card = cards.nth(i);
      const titleNode = card.locator("div[style*='font-weight: 500'] > div").first();
      const previewNode = card.locator("div[style*='font-size: 12px'][style*='max-width: 165px']").first();
      const timeNode = card.locator("div[style*='font-size: 10px']").first();

      const title = (await titleNode.count()) > 0 ? compactWhitespace(await textContent(titleNode)) : "";
      const preview = (await previewNode.count()) > 0 ? compactWhitespace(await textContent(previewNode)) : "";
      const time = (await timeNode.count()) > 0 ? compactWhitespace(await textContent(timeNode)) : "";

      if (!title) continue;
      if (title === "通知消息" || title === "闲小蜜") continue;
      if (/交易关闭|官方客服|系统消息/.test(title)) continue;

      await card.click();
      await this.page.waitForTimeout(800);
      return {
        id: `conv-${i}-${title}`,
        title,
        preview,
        time
      };
    }

    return null;
  }

  async summarizeConversationList(limit = 5) {
    const cards = await this.listConversationCards();
    const count = await cards.count();
    const items = [];

    for (let i = 0; i < Math.min(count, limit); i += 1) {
      const card = cards.nth(i);
      const titleNode = card.locator("div[style*='font-weight: 500'] > div").first();
      const previewNode = card.locator("div[style*='font-size: 12px'][style*='max-width: 165px']").first();
      const timeNode = card.locator("div[style*='font-size: 10px']").first();
      items.push({
        title: (await titleNode.count()) > 0 ? compactWhitespace(await textContent(titleNode)) : "",
        preview: (await previewNode.count()) > 0 ? compactWhitespace(await textContent(previewNode)) : "",
        time: (await timeNode.count()) > 0 ? compactWhitespace(await textContent(timeNode)) : ""
      });
    }

    return { count, items };
  }

  async readCurrentMessages(maxMessages) {
    let locator = null;
    for (const selector of MESSAGE_SELECTORS) {
      const candidate = this.page.locator(selector);
      if (await candidate.count() > 0) {
        locator = candidate;
        break;
      }
    }

    if (!locator) {
      throw new Error("Could not find message items. Update selectors in src/xianyu-page.js");
    }

    const count = await locator.count();
    const start = Math.max(0, count - maxMessages);
    const messages = [];

    for (let i = start; i < count; i += 1) {
      const item = locator.nth(i);
      const textNode = item.locator("[class*='message-text'] span").first();
      const text = (await textNode.count()) > 0 ? await textContent(textNode) : await textContent(item);
      if (!text) continue;
      const direction = (await item.getAttribute("style")) || "";
      const role = direction.includes("rtl") ? "seller" : "buyer";
      messages.push({ role, text });
    }

    return messages;
  }

  async readConversationContext() {
    const buyerNameNode = this.page.locator(".message-topbar--uzL8Czfo .text1--DZXvZYq5").first();
    const buyerRegionNode = this.page.locator(".message-topbar--uzL8Czfo .text2--S10AsTZt").first();
    const itemLinkNode = this.page.locator(".left--UqpSF6uz a[href*='item']").first();
    const priceNode = this.page.locator(".left--UqpSF6uz .money--eRmgu0Fl").first();
    const deliveryNodes = this.page.locator(".left--UqpSF6uz .delivery--hE_9wxIP");

    const buyerName = (await buyerNameNode.count()) > 0 ? compactWhitespace(await textContent(buyerNameNode)) : "";
    const buyerRegion = (await buyerRegionNode.count()) > 0 ? compactWhitespace(await textContent(buyerRegionNode)) : "";
    const itemUrl = (await itemLinkNode.count()) > 0 ? (await itemLinkNode.getAttribute("href")) || "" : "";
    const priceText = (await priceNode.count()) > 0 ? compactWhitespace(await textContent(priceNode)) : "";

    let shippingText = "";
    let locationText = "";
    const deliveryCount = await deliveryNodes.count();
    if (deliveryCount > 0) {
      shippingText = compactWhitespace(await textContent(deliveryNodes.nth(0)));
    }
    if (deliveryCount > 1) {
      locationText = compactWhitespace(await textContent(deliveryNodes.nth(1)));
    }

    const itemId = (() => {
      if (!itemUrl) return "";
      try {
        const url = new URL(itemUrl, "https://www.goofish.com");
        return url.searchParams.get("id") || "";
      } catch {
        return "";
      }
    })();

    return {
      buyerName,
      buyerRegion,
      itemUrl,
      itemId,
      priceText,
      priceValue: firstNumberFromText(priceText),
      shippingText,
      locationText
    };
  }

  async sendReply(text) {
    let input = null;
    for (const selector of INPUT_SELECTORS) {
      const candidate = this.page.locator(selector).first();
      if (await candidate.count() > 0) {
        input = candidate;
        break;
      }
    }

    if (!input) {
      throw new Error("Could not find reply input box. Update selectors in src/xianyu-page.js");
    }

    await input.click();
    await input.fill("");
    await input.fill(text);
    await input.dispatchEvent("input");
    await input.dispatchEvent("change");
    await this.page.waitForTimeout(200);

    for (const selector of SEND_SELECTORS) {
      const button = this.page.locator(selector).first();
      if (await button.count() > 0) {
        if (await button.isDisabled()) {
          await input.fill("");
          await input.pressSequentially(text, { delay: 20 });
          await input.dispatchEvent("input");
          await input.dispatchEvent("change");
          await this.page.waitForTimeout(300);
        }
        await button.click();
        return;
      }
    }

    await input.press("Enter");
  }
}
