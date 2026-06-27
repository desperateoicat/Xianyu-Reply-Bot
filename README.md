# Xianyu Auto Reply

基于 `Playwright + DeepSeek API` 的闲鱼自动回复脚本。

## 功能

- 复用本地 Chrome 登录态
- 自动进入闲鱼消息页
- 读取会话列表与当前会话消息
- 读取当前会话关联商品信息（价格、运费、地区、商品链接/ID）
- 调用 DeepSeek 生成中文回复
- 按规则过滤高风险消息
- 自动发送并做本地去重

## 风险

- 闲鱼页面结构会变，选择器需要维护
- 平台可能有反自动化机制
- 不建议自动处理退款、投诉、改价、隐私等高风险问题

## 使用

1. 安装依赖

```powershell
npm install
```

2. 复制环境变量模板

```powershell
Copy-Item .env.example .env
```

3. 填写 `.env`

- `DEEPSEEK_API_KEY`: DeepSeek API Key
- `CHROME_EXECUTABLE_PATH`: 本机 Chrome 路径，可留空让 Playwright 自动查找
- `CHROME_USER_DATA_DIR`: Chrome 用户数据目录，默认 `./chrome-profile`（项目内置，已加入 `.gitignore`）
- `XIANYU_MESSAGES_URL`: 默认闲鱼消息页
- `OPEN_CONVERSATION_RETRY_COUNT`: 页面初始加载后，重试查找会话列表的次数
- `OPEN_CONVERSATION_RETRY_DELAY_MS`: 每次重试间隔
- `BARGAIN_FLOOR_RATIO`: 议价底线比例，例如 `0.9` 表示最低回复价默认为标价的 90%
- `BARGAIN_FLOOR_OFFSET`: 议价底线再减去的固定金额，默认 `0`

4. 运行

```powershell
npm start
```

5. 检查运行状态

```powershell
npm run status
```

这个状态检查不会启动浏览器，也不会影响正在运行的自动回复进程。

查看运行状态，不启动浏览器：

```powershell
npm run status
```

## 建议

- 先把 `AUTO_SEND=false` 跑通，确认页面读取正常
- 再切 `AUTO_SEND=true`
- 首次运行建议手动登录闲鱼并保持登录态
- 不要用 `npm run debug:browser` 做“是否在运行”的检测；这个命令本来就是一次性打开浏览器采样，跑完会主动关闭浏览器

## 商品配置

商品级配置在 `products.json`，示例见 [products.example.json](products.example.json)。

推荐匹配方式：

- 优先用 `itemId`
  - 更稳定，URL 参数变化不影响匹配
- 必要时再用 `itemUrl`
  - 适合你还没整理 `itemId` 的情况

字段说明：

- `defaults.prompt`
  - 所有商品共享的附加提示词
- `defaults.pricing`
  - 所有商品共享的默认议价规则
- `products[].itemId`
  - 单商品唯一标识，推荐
- `products[].itemUrl`
  - 单商品 URL，作为兜底匹配
- `products[].prompt`
  - 该商品专属提示词
- `products[].pricing.floorPrice`
  - 该商品固定议价底线，优先级最高
- `products[].pricing.floorRatio`
  - 按标价比例算议价底线
- `products[].pricing.floorOffset`
  - 在比例基础上再减去的固定金额

## 许可证

本项目采用 [CC BY-NC-ND 4.0](LICENSE) 许可协议。

- 允许个人使用和分享
- 禁止用于商业目的
- 禁止二次创作、修改后分发

## 交流群

<img src="XianyuAIBot交流群二维码.png" alt="交流群二维码" width="300" />

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=desperateoicat/Xianyu-Reply-Bot&type=Date)](https://star-history.com/#desperateoicat/Xianyu-Reply-Bot&Date)
