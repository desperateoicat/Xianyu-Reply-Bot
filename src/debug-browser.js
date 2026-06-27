import fs from "node:fs";
import { config } from "./config.js";
import { createLogger } from "./logger.js";
import {
  CONVERSATION_SELECTORS,
  INPUT_SELECTORS,
  MESSAGE_SELECTORS,
  SEND_SELECTORS,
  XianyuPage
} from "./xianyu-page.js";

async function main() {
  const logger = createLogger(config.paths.logFile);
  const page = new XianyuPage(
    {
      ...config.browser,
      messagesUrl: config.xianyu.messagesUrl
    },
    logger
  );

  await page.start();
  await page.page.waitForTimeout(3000);

  const selectorGroups = {
    conversation: CONVERSATION_SELECTORS,
    message: MESSAGE_SELECTORS,
    input: INPUT_SELECTORS,
    send: SEND_SELECTORS
  };

  const counts = {};
  for (const [group, selectors] of Object.entries(selectorGroups)) {
    counts[group] = {};
    for (const selector of selectors) {
      counts[group][selector] = await page.page.locator(selector).count();
    }
  }

  const beforeOpen = {
    emptyStateText: await (async () => {
      const emptyState = page.page.locator("#conv-list-scrollable .empty-container--Vp3wMU3E").first();
      if ((await emptyState.count()) === 0) {
        return null;
      }
      return (await emptyState.textContent())?.trim() || null;
    })(),
    conversations: await page.summarizeConversationList(),
    counts
  };

  const openedConversation = await page.openLatestUnreadConversation();
  await page.page.waitForTimeout(1500);

  const countsAfterOpen = {};
  for (const [group, selectors] of Object.entries(selectorGroups)) {
    countsAfterOpen[group] = {};
    for (const selector of selectors) {
      countsAfterOpen[group][selector] = await page.page.locator(selector).count();
    }
  }

  const payload = {
    url: page.page.url(),
    title: await page.page.title(),
    beforeOpen,
    openedConversation,
    messageCount: await page.page.locator("#msg-list-container .ant-list-item").count(),
    countsAfterOpen
  };

  fs.writeFileSync(config.paths.debugJsonFile, JSON.stringify(payload, null, 2), "utf8");
  fs.writeFileSync(config.paths.debugHtmlFile, await page.page.content(), "utf8");

  console.log(JSON.stringify(payload, null, 2));
  console.log(`HTML snapshot: ${config.paths.debugHtmlFile}`);
  console.log(`Selector report: ${config.paths.debugJsonFile}`);

  await page.stop();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
