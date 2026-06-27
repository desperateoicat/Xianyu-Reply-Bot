export class DeepSeekClient {
  constructor(config) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.apiKey = config.apiKey;
    this.model = config.model;
    if (!this.apiKey) {
      throw new Error("Missing DeepSeek API key");
    }
  }

  async generateReply(input) {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content: [
              "你是一个闲鱼卖家自动回复助手。",
              "目标是快速、自然、简洁地回复买家。",
              "只输出最终回复文本，不要解释。",
              "不要承诺你不知道的库存、发货时间、改价结果。",
              "遇到退款、投诉、辱骂、平台处罚、隐私、手机号、微信导流等风险场景时输出：[[ESCALATE]]"
            ].join("\n")
          },
          {
            role: "user",
            content: input
          }
        ]
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`DeepSeek API error ${response.status}: ${text}`);
    }

    const json = await response.json();
    return json.choices?.[0]?.message?.content?.trim() || "";
  }
}
