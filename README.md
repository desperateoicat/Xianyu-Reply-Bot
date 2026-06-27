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

### 1. 安装依赖

```powershell
npm install
```

> 如果没有执行这一步直接运行，会报 `Cannot find package 'dotenv'` 错误。

### 2. 复制环境变量模板（可选）

```powershell
Copy-Item .env.example .env
```

即使跳过这一步也**不会影响启动**，你可以在 Web 管理面板中完成所有配置。

### 3. 启动程序

```powershell
npm start
```

启动后访问管理面板：**http://127.0.0.1:3456**

管理面板会**始终启动**，即使你还没有配置任何参数。你可以在面板中完成以下所有设置：

- 填写 DeepSeek API Key、选择模型
- 切换自动发送开关、调整轮询间隔
- 配置 Chrome 浏览器路径
- 管理商品列表和回复提示词
- 查看运行状态和日志

配置完成后，点击面板顶部的「启动服务」按钮即可开始自动回复。

### 4. 手动配置 .env（可选替代方式）

如果你更习惯直接编辑文件，也可以在 `.env` 中填写以下变量：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DEEPSEEK_API_KEY` | DeepSeek API Key（必填） | - |
| `DEEPSEEK_BASE_URL` | DeepSeek API 地址 | `https://api.deepseek.com` |
| `DEEPSEEK_MODEL` | 模型名称 | `deepseek-v4-flash` |
| `XIANYU_MESSAGES_URL` | 闲鱼消息页地址 | `https://www.goofish.com/im` |
| `POLL_INTERVAL_MS` | 轮询间隔（毫秒） | `15000` |
| `AUTO_SEND` | 是否自动发送回复 | `true` |
| `MAX_HISTORY_MESSAGES` | 每次读取的最大历史消息数 | `12` |
| `MAX_REPLY_CHARS` | 单次回复最大字数 | `120` |
| `CHROME_EXECUTABLE_PATH` | Chrome 可执行文件路径 | 自动查找 |
| `CHROME_USER_DATA_DIR` | Chrome 用户数据目录 | `./chrome-profile` |
| `CHROME_PROFILE` | Chrome 用户配置名 | `Default` |
| `HEADLESS` | 无头模式（不显示浏览器窗口） | `false` |
| `OPEN_CONVERSATION_RETRY_COUNT` | 查找会话列表重试次数 | `8` |
| `OPEN_CONVERSATION_RETRY_DELAY_MS` | 每次重试间隔（毫秒） | `800` |

### 5. 检查运行状态

```powershell
npm run status
```

状态检查不会启动浏览器，也不会影响正在运行的自动回复进程。

## 常见问题

### Q: 运行时报 `Cannot find package 'dotenv'`

**原因**：没有安装项目依赖。

**解决**：在项目根目录执行 `npm install`，安装完成后再运行 `npm start`。

### Q: 运行时报 `EADDRINUSE: address already in use 127.0.0.1:3456`

**原因**：端口 3456 已被占用，通常是之前的程序实例没有完全关闭。

**解决**：

```powershell
# 1. 查找占用端口的进程 PID
netstat -ano | findstr :3456
# 输出示例：TCP  127.0.0.1:3456  ...  LISTENING  12345

# 2. 终止该进程（将 12345 替换为实际的 PID）
taskkill /PID 12345 /F

# 3. 重新启动
npm start
```

### Q: 启动后在哪里配置 API Key？

打开浏览器访问 **http://127.0.0.1:3456**，进入「系统设置」标签页，填写 DeepSeek API Key 后保存。然后点击顶部的「启动服务」按钮。

### Q: 如何获取 DeepSeek API Key？

前往 [DeepSeek 开放平台](https://platform.deepseek.com) 注册并登录，在控制台中创建 API Key。

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

<img src="XianyuAIBot交流群二维码.png" alt="交流群二维码" width="400" />

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=desperateoicat/Xianyu-Reply-Bot&type=Date)](https://star-history.com/#desperateoicat/Xianyu-Reply-Bot&Date)
