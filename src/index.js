import path from "node:path";
import dotenv from "dotenv";
import { startAdminServer } from "./admin.js";
import { config } from "./config.js";
import { DeepSeekClient } from "./deepseek.js";
import { writeHeartbeat } from "./heartbeat.js";
import { createLogger } from "./logger.js";
import { loadProductConfig, resolveProductProfile } from "./product-config.js";
import { assessConversation, normalizeReply } from "./rules.js";
import { hasReplied, loadState, markReplied, saveState } from "./state.js";
import { XianyuPage } from "./xianyu-page.js";

function buildPrompt(conversation) {
  const ctx = conversation.context || {};
  const styleHints = conversation.styleHints || [];
  const productPrompt = conversation.productPrompt || [];
  const latestBuyerText = conversation.messages.at(-1)?.text || "";
  const responseScope = describeResponseScope(conversation);
  return [
    `商品/会话标题: ${conversation.title}`,
    `买家昵称: ${ctx.buyerName || "未知"}`,
    `买家地区: ${ctx.buyerRegion || "未知"}`,
    `商品ID: ${ctx.itemId || "未知"}`,
    `商品价格: ${ctx.priceText || "未知"}`,
    `运费信息: ${ctx.shippingText || "未知"}`,
    `商品地区: ${ctx.locationText || "未知"}`,
    `商品链接: ${ctx.itemUrl || "未知"}`,
    `风格模板: ${styleHints.length > 0 ? styleHints.join(" / ") : "通用闲鱼卖家口吻"}`,
    `商品专属提示: ${productPrompt.length > 0 ? productPrompt.join(" / ") : "无"}`,
    `买家这轮核心问题: ${latestBuyerText || "无"}`,
    `本轮回复范围: ${responseScope}`,
    "最近对话：",
    ...conversation.messages.map((item) => `${item.role === "buyer" ? "买家" : "卖家"}: ${item.text}`),
    "",
    "要求：",
    "1. 回复自然口语化",
    "2. 尽量简短，优先 1 到 2 句",
    "3. 不要编造承诺",
    "4. 不要带表情包",
    "5. 如果买家问题和商品价格、运费、发货地有关，优先结合上面的商品信息回复",
    "6. 如果买家在砍价，一律不降价，不要报底价，不要报最低价，只做简短拒绝。",
    "7. 按风格模板调整语气，不要像统一客服",
    "8. 如果商品专属提示不为空，优先服从商品专属提示",
    "9. 严禁自行猜测商品名称、品类、品牌、用途、成色、库存、发货时效。",
    "10. 如果上下文没有明确给出商品名称或品类，不要说“这是某某商品/某某挂件/某某周边”。",
    "11. 只能使用已知事实：价格、运费、地区、买家问题、商品专属提示。",
    "12. 买家没有主动问价格、运费、优惠、最低价时，不要主动报价格，也不要主动降价。",
    "13. 买家只是确认在不在、能不能做、多久能好时，先直接回答问题，不要顺带报价。",
    "14. 说话像真人卖家，不要像客服话术，不要每句都完整正式。",
    "15. 能短就短，允许用“在”“可以”“能做”“稍等我看下”这种自然说法。",
    "16. 不要使用“您好”“亲”“这边”“为您”“请您”“感谢您的咨询”这类客服口吻。",
    "17. 除非买家语气正式，否则不要刻意礼貌过头。",
    "18. 对于“便宜点、最低多少、能少吗、优惠点、刀吗”这类问题，统一按不讲价处理，不要给任何新的价格数字。",
    "19. 只回答买家这轮实际问到的内容，不要主动补充没被问到的信息。",
    "20. 如果买家只问一个点，就只回那个点；不要顺带解释商品背景、流程、售后、价格、最低价。",
    "21. 对未知信息直接避开，不要硬编；没必要回答的内容就不说。"
  ].join("\n");
}

function fingerprint(messages) {
  return messages.map((item) => `${item.role}:${item.text}`).join("|");
}

function buildConversationId(opened, context) {
  const itemId = context?.itemId || "unknown-item";
  const buyer = (context?.buyerName || opened?.title || "unknown-buyer")
    .replace(/\s+/g, "")
    .slice(0, 40);
  return `${itemId}:${buyer}`;
}

function buildSafeFallbackReply(conversation) {
  const latest = conversation.messages.at(-1)?.text || "";
  const price = conversation.context?.priceText || "";
  const shipping = conversation.context?.shippingText || "";

  if (/在吗|在不|还在|有货|能拍/.test(latest)) {
    return "在的。";
  }
  if (/多少|几块|价格|包邮|运费|邮费/.test(latest)) {
    if (price && shipping) return `${price}，${shipping}。`;
    if (price) return `${price}。`;
  }
  if (/能不能|可以吗|可开|多开/.test(latest)) {
    return "可以的。";
  }
  return "在的。";
}

function hasUngroundedProductClaims(reply, conversation) {
  const contextText = [
    conversation.title,
    conversation.context?.buyerName,
    conversation.context?.buyerRegion,
    conversation.context?.itemId,
    conversation.context?.itemUrl,
    conversation.context?.priceText,
    conversation.context?.shippingText,
    conversation.context?.locationText,
    ...(conversation.productPrompt || []),
    ...conversation.messages.map((item) => item.text)
  ]
    .filter(Boolean)
    .join("\n");

  const suspiciousTerms = [
    "挂件",
    "周边",
    "手机",
    "电脑",
    "耳机",
    "手表",
    "衣服",
    "裤子",
    "鞋",
    "键盘",
    "鼠标",
    "账号",
    "游戏号"
  ];

  return suspiciousTerms.some((term) => reply.includes(term) && !contextText.includes(term));
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function buildHoldingReply(conversation) {
  const latest = conversation.messages.at(-1)?.text || "";
  if (/在吗|在不|还在/.test(latest)) {
    return pickRandom(["在的", "在，稍等", "稍等一下", "在的，稍等下。"]);
  }
  if (/多少|几块|价格|包邮|运费|邮费/.test(latest)) {
    return pickRandom(["在的，稍等下，我看下再回你。", "稍等，我看下。", "在的，我看下告诉你。"]);
  }
  if (/能不能|可以吗|可开|多开/.test(latest)) {
    return pickRandom(["可以聊，稍等下我确认一下。", "稍等我确认下。", "我看看，稍等。"]);
  }
  return pickRandom(["在的", "在，稍等", "稍等一下", "在的，稍等下。"]);
}

function classifyBuyerIntent(text) {
  const latest = text || "";
  if (/便宜|最低|少点|优惠|刀|砍价|改价/.test(latest)) return "bargain";
  if (/多少|几块|价格|包邮|运费|邮费/.test(latest)) return "price";
  if (/在吗|在不|还在|有人吗/.test(latest)) return "presence";
  if (/能不能|可以吗|能做吗|可开|多开|接吗/.test(latest)) return "availability";
  if (/多久|什么时候|多长时间/.test(latest)) return "timing";
  return "other";
}

function describeResponseScope(conversation) {
  const latest = conversation.messages.at(-1)?.text || "";
  const scopes = [];
  if (/在吗|在不|还在|有人吗/.test(latest)) scopes.push("只确认是否在");
  if (/能不能|可以吗|能做吗|可开|多开|接吗/.test(latest)) scopes.push("只确认能不能做");
  if (/多久|什么时候|多长时间/.test(latest)) scopes.push("只回答时间相关");
  if (/多少|几块|价格|包邮|运费|邮费/.test(latest)) scopes.push("只回答价格或运费");
  if (/怎么发|怎么给|怎么交易|怎么弄/.test(latest)) scopes.push("只回答交付方式");
  if (/便宜|最低|少点|优惠|刀|砍价|改价/.test(latest)) scopes.push("只拒绝讲价");
  if (/包撤|售后|稳不稳|安全吗|会不会封/.test(latest)) scopes.push("只回答买家问到的售后或风险点");
  if (scopes.length === 0) {
    return "只围绕买家最后一句作答，不扩展，不主动补充";
  }
  return `${scopes.join("；")}；其他没问到的不答`;
}

function buildBargainRefusalReply(conversation) {
  const latest = conversation.messages.at(-1)?.text || "";
  if (/最低/.test(latest)) {
    return "这个不再少了。";
  }
  if (/便宜|少点|优惠|刀|砍价|改价/.test(latest)) {
    return "这个不讲价。";
  }
  return "价格就这样。";
}

function mentionsForbiddenPriceReply(reply, conversation) {
  const latest = conversation.messages.at(-1)?.text || "";
  const intent = classifyBuyerIntent(latest);
  if (intent === "bargain") {
    return /最低|底价|保底|¥\s*\d+|\b\d+(?:\.\d+)?\b/.test(reply);
  }
  if (intent === "price") {
    return /最低|底价|保底/.test(reply);
  }
  return /最低|底价|保底|¥\s*\d+|\b\d+(?:\.\d+)?\b/.test(reply);
}

function humanizeReply(reply) {
  let text = reply.trim();
  const replacements = [
    [/^您好[，,\s]*/g, ""],
    [/^你好[，,\s]*/g, ""],
    [/这边/g, ""],
    [/为您/g, ""],
    [/请您/g, "你"],
    [/感谢您的咨询[。！!]*/g, ""],
    [/亲[，,\s]*/g, ""]
  ];

  for (const [pattern, value] of replacements) {
    text = text.replace(pattern, value);
  }

  text = text.replace(/\s+/g, " ").trim();
  text = text.replace(/。{2,}/g, "。");
  text = text.replace(/([，,])\1+/g, "$1");

  if (/^(在的|可以的|能做的|行的)[。！!]?$/.test(text)) {
    return text.replace(/的/g, "").replace(/[。！!]$/, "");
  }

  return text;
}

function trimToBuyerQuestion(reply, conversation) {
  const latest = conversation.messages.at(-1)?.text || "";
  const compact = reply.trim();
  if (!compact) return compact;

  const split = compact.split(/(?<=[。！？!?.])/).map((item) => item.trim()).filter(Boolean);
  if (split.length <= 1) {
    return compact;
  }

  const singleIntent =
    /在吗|在不|还在|有人吗/.test(latest) ||
    /能不能|可以吗|能做吗|可开|多开|接吗/.test(latest) ||
    /多久|什么时候|多长时间/.test(latest) ||
    /多少|几块|价格|包邮|运费|邮费/.test(latest) ||
    /便宜|最低|少点|优惠|刀|砍价|改价/.test(latest);

  return singleIntent ? split[0] : compact;
}

function detectStyleHints(conversation) {
  const text = [conversation.title, ...conversation.messages.map((item) => item.text)]
    .join("\n")
    .toLowerCase();

  const hints = [];
  if (/号|账号|开一个号|多开|游戏|卡密|兑换|资格/.test(text)) {
    hints.push("数字商品：简短直接，重点回答是否可用、如何交付、是否还能开");
  }
  if (/成色|瑕疵|几新|磨损|划痕/.test(text)) {
    hints.push("实物二手：强调成色、是否现货、发货速度");
  }
  if (/包邮|运费|邮费|发货地|什么时候发/.test(text)) {
    hints.push("物流咨询：优先明确运费、发货地、发货时间");
  }
  if (/便宜|最低|少点|优惠|刀|砍价/.test(text)) {
    hints.push("议价场景：给出明确边界，不要无限拉扯");
  }
  return hints;
}

function createServiceController() {
  let running = false;
  let logger = null;
  let page = null;

  return {
    isRunning() {
      return running;
    },
    async start() {
      if (running) return;

      // 重新读取 .env（管理面板可能已经修改过）
      dotenv.config({ path: path.join(config.paths.projectRoot, ".env") });

      const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
      if (!apiKey) {
        throw new Error("请先在管理面板的「系统设置」中配置 DeepSeek API Key 后再启动服务");
      }

      // 从环境变量重建配置（确保使用管理面板修改后的最新值）
      const freshDeepSeekConfig = {
        apiKey,
        baseUrl: process.env.DEEPSEEK_BASE_URL?.trim() || "https://api.deepseek.com",
        model: process.env.DEEPSEEK_MODEL?.trim() || "deepseek-v4-flash"
      };
      const freshXianyuConfig = {
        ...config.xianyu,
        messagesUrl: process.env.XIANYU_MESSAGES_URL?.trim() || config.xianyu.messagesUrl,
        pollIntervalMs: process.env.POLL_INTERVAL_MS ? Number(process.env.POLL_INTERVAL_MS) : config.xianyu.pollIntervalMs,
        autoSend: process.env.AUTO_SEND ? ["1", "true", "yes", "on"].includes(process.env.AUTO_SEND.trim().toLowerCase()) : config.xianyu.autoSend,
        maxHistoryMessages: process.env.MAX_HISTORY_MESSAGES ? Number(process.env.MAX_HISTORY_MESSAGES) : config.xianyu.maxHistoryMessages,
        maxReplyChars: process.env.MAX_REPLY_CHARS ? Number(process.env.MAX_REPLY_CHARS) : config.xianyu.maxReplyChars,
        openConversationRetryCount: process.env.OPEN_CONVERSATION_RETRY_COUNT ? Number(process.env.OPEN_CONVERSATION_RETRY_COUNT) : config.xianyu.openConversationRetryCount,
        openConversationRetryDelayMs: process.env.OPEN_CONVERSATION_RETRY_DELAY_MS ? Number(process.env.OPEN_CONVERSATION_RETRY_DELAY_MS) : config.xianyu.openConversationRetryDelayMs
      };
      const freshBrowserConfig = {
        ...config.browser,
        executablePath: process.env.CHROME_EXECUTABLE_PATH?.trim() || config.browser.executablePath,
        userDataDir: process.env.CHROME_USER_DATA_DIR?.trim() || config.browser.userDataDir,
        profile: process.env.CHROME_PROFILE?.trim() || config.browser.profile,
        headless: process.env.HEADLESS ? ["1", "true", "yes", "on"].includes(process.env.HEADLESS.trim().toLowerCase()) : config.browser.headless
      };

      const productConfig = loadProductConfig(config.paths.productConfigFile);
      const state = loadState(config.paths.stateFile);
      const client = new DeepSeekClient(freshDeepSeekConfig);

      logger = createLogger(config.paths.logFile);
      const xianyuCfg = freshXianyuConfig;

      page = new XianyuPage(
        {
          ...freshBrowserConfig,
          messagesUrl: xianyuCfg.messagesUrl,
          openConversationRetryCount: xianyuCfg.openConversationRetryCount,
          openConversationRetryDelayMs: xianyuCfg.openConversationRetryDelayMs
        },
        logger
      );

      await page.start();
      writeHeartbeat(config.paths.heartbeatFile, {
        status: "running",
        autoSend: xianyuCfg.autoSend,
        pollIntervalMs: xianyuCfg.pollIntervalMs,
        phase: "started"
      });
      logger.info("Auto reply worker started", {
        autoSend: xianyuCfg.autoSend,
        pollIntervalMs: xianyuCfg.pollIntervalMs
      });

      running = true;

      // 工作循环（异步执行，不阻塞 start 返回）
      (async () => {
        while (running) {
          try {
            const opened = await page.openLatestUnreadConversation();
            if (!opened) {
              logger.info("No conversation found");
              await wait(xianyuCfg.pollIntervalMs);
              continue;
            }

            const messages = await page.readCurrentMessages(xianyuCfg.maxHistoryMessages);
            const context = await page.readConversationContext();
            const productProfile = resolveProductProfile(productConfig, context);
            const conversationId = buildConversationId(opened, context);
            writeHeartbeat(config.paths.heartbeatFile, {
              status: "running",
              autoSend: xianyuCfg.autoSend,
              pollIntervalMs: xianyuCfg.pollIntervalMs,
              phase: "polling",
              lastConversationTitle: opened?.title || "",
              lastConversationId: conversationId
            });
            const conversation = {
              id: conversationId,
              title: opened.title,
              messages,
              context,
              productPrompt: [
                ...(productConfig.defaults?.prompt || []),
                ...(productProfile?.prompt || [])
              ]
            };
            conversation.styleHints = detectStyleHints(conversation);

            const currentFingerprint = fingerprint(messages);
            if (hasReplied(state, conversation.id, currentFingerprint)) {
              logger.info("Skipping already-processed conversation", { id: conversation.id });
              await wait(xianyuCfg.pollIntervalMs);
              continue;
            }

            const assessment = assessConversation(conversation);
            if (assessment.action !== "reply") {
              logger.warn("Conversation escalated or skipped", {
                id: conversation.id,
                reason: assessment.reason
              });
              markReplied(state, conversation.id, currentFingerprint);
              saveState(config.paths.stateFile, state);
              await wait(xianyuCfg.pollIntervalMs);
              continue;
            }

            const latestBuyerText = conversation.messages.at(-1)?.text || "";
            const buyerIntent = classifyBuyerIntent(latestBuyerText);
            const isBargainTurn = buyerIntent === "bargain";
            if (isBargainTurn) {
              const finalReply = humanizeReply(buildBargainRefusalReply(conversation));
              logger.info("Rule-based bargain refusal", {
                id: conversation.id,
                reply: finalReply,
                itemId: context.itemId
              });
              if (xianyuCfg.autoSend) {
                await page.sendReply(finalReply);
                logger.info("Reply sent", { id: conversation.id, mode: "bargain_refusal" });
                writeHeartbeat(config.paths.heartbeatFile, {
                  status: "running",
                  autoSend: xianyuCfg.autoSend,
                  pollIntervalMs: xianyuCfg.pollIntervalMs,
                  phase: "reply_sent",
                  lastConversationId: conversation.id,
                  lastReply: finalReply
                });
              } else {
                logger.info("AUTO_SEND=false, draft only", { id: conversation.id, mode: "bargain_refusal" });
              }
              markReplied(state, conversation.id, currentFingerprint);
              saveState(config.paths.stateFile, state);
              await wait(xianyuCfg.pollIntervalMs);
              continue;
            }

            const rawReply = await client.generateReply(buildPrompt(conversation));
            if (!rawReply || rawReply === "[[ESCALATE]]") {
              logger.warn("Model requested escalation", { id: conversation.id });
              markReplied(state, conversation.id, currentFingerprint);
              saveState(config.paths.stateFile, state);
              await wait(xianyuCfg.pollIntervalMs);
              continue;
            }

            const reply = normalizeReply(rawReply, xianyuCfg.maxReplyChars);
            if (!reply) {
              logger.warn("Model returned empty reply", { id: conversation.id });
              await wait(xianyuCfg.pollIntervalMs);
              continue;
            }

            const groundedReply = hasUngroundedProductClaims(reply, conversation)
              ? buildSafeFallbackReply(conversation)
              : reply;
            const finalReply = trimToBuyerQuestion(humanizeReply(
              mentionsForbiddenPriceReply(groundedReply, conversation)
                ? buildBargainRefusalReply(conversation)
                : groundedReply
            ), conversation);

            if (!productProfile) {
              const holdingReply = buildHoldingReply(conversation);
              logger.warn("Missing product profile, using holding reply", {
                id: conversation.id,
                title: conversation.title,
                itemId: context.itemId,
                itemUrl: context.itemUrl,
                reply: holdingReply
              });
              if (xianyuCfg.autoSend) {
                await page.sendReply(holdingReply);
                logger.info("Reply sent", { id: conversation.id, mode: "holding" });
                writeHeartbeat(config.paths.heartbeatFile, {
                  status: "running",
                  autoSend: xianyuCfg.autoSend,
                  pollIntervalMs: xianyuCfg.pollIntervalMs,
                  phase: "holding_reply_sent",
                  lastConversationId: conversation.id,
                  lastReply: holdingReply
                });
              } else {
                logger.info("AUTO_SEND=false, draft only", { id: conversation.id, mode: "holding" });
              }
              markReplied(state, conversation.id, currentFingerprint);
              saveState(config.paths.stateFile, state);
              await wait(xianyuCfg.pollIntervalMs);
              continue;
            }

            logger.info("Generated reply", {
              id: conversation.id,
              reply: finalReply,
              itemId: context.itemId,
              price: context.priceText,
              styleHints: conversation.styleHints,
              productName: productProfile?.name || "",
              productPrompt: conversation.productPrompt
            });
            if (xianyuCfg.autoSend) {
              await page.sendReply(finalReply);
              logger.info("Reply sent", { id: conversation.id });
              writeHeartbeat(config.paths.heartbeatFile, {
                status: "running",
                autoSend: xianyuCfg.autoSend,
                pollIntervalMs: xianyuCfg.pollIntervalMs,
                phase: "reply_sent",
                lastConversationId: conversation.id,
                lastReply: finalReply
              });
            } else {
              logger.info("AUTO_SEND=false, draft only", { id: conversation.id });
            }

            markReplied(state, conversation.id, currentFingerprint);
            saveState(config.paths.stateFile, state);
          } catch (error) {
            logger.error("Worker loop failed", {
              message: error instanceof Error ? error.message : String(error)
            });
            writeHeartbeat(config.paths.heartbeatFile, {
              status: "running",
              autoSend: xianyuCfg.autoSend,
              pollIntervalMs: xianyuCfg.pollIntervalMs,
              phase: "error",
              error: error instanceof Error ? error.message : String(error)
            });
          }

          await wait(xianyuCfg.pollIntervalMs);
        }

        // 循环结束后清理
        if (page) {
          try { await page.stop(); } catch { /* ignore */ }
        }
        writeHeartbeat(config.paths.heartbeatFile, {
          status: "stopped",
          autoSend: xianyuCfg.autoSend,
          pollIntervalMs: xianyuCfg.pollIntervalMs,
          phase: "stopped_by_user"
        });
        logger.info("Auto reply worker stopped");
      })();
    },
    stop() {
      if (!running) return;
      running = false;
    }
  };
}

async function main() {
  const serviceController = createServiceController();

  // 启动 Web 管理面板（无论是否配置完成，面板始终可用）
  const adminServer = startAdminServer(config.paths.projectRoot, serviceController);

  writeHeartbeat(config.paths.heartbeatFile, {
    status: "idle",
    autoSend: config.xianyu.autoSend,
    pollIntervalMs: config.xianyu.pollIntervalMs,
    phase: "admin_ready"
  });

  if (!config.deepseek.apiKey) {
    console.log("[ADMIN] DeepSeek API Key 未配置，请在管理面板中设置后启动服务");
  }

  // 保持进程存活
  await new Promise(() => {});
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    writeHeartbeat(config.paths.heartbeatFile, {
      status: "stopped",
      autoSend: config.xianyu.autoSend,
      pollIntervalMs: config.xianyu.pollIntervalMs,
      phase: "signal",
      signal
    });
    process.exit(0);
  });
}

main().catch((error) => {
  writeHeartbeat(config.paths.heartbeatFile, {
    status: "stopped",
    autoSend: config.xianyu.autoSend,
    pollIntervalMs: config.xianyu.pollIntervalMs,
    phase: "fatal",
    error: error instanceof Error ? error.message : String(error)
  });
  console.error(error);
  process.exitCode = 1;
});
