import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function jsonResponse(res, code, data) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data, null, 2));
}

function readJSON(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function buildHtmlPage() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>闲鱼自动回复 - 管理面板</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f6fa; color: #2d3436; }
  .header { background: #1e272e; color: #fff; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; }
  .header h1 { font-size: 20px; font-weight: 600; }
  .tabs { display: flex; gap: 4px; background: #1e272e; padding: 0 24px 12px; }
  .tab { padding: 8px 20px; border-radius: 6px; cursor: pointer; color: #a4b0be; font-size: 14px; transition: all .2s; border: none; background: transparent; }
  .tab:hover { color: #fff; background: rgba(255,255,255,0.08); }
  .tab.active { color: #1e272e; background: #f5f6fa; font-weight: 600; }
  .main { max-width: 1100px; margin: 24px auto; padding: 0 24px; }
  .card { background: #fff; border-radius: 10px; padding: 24px; margin-bottom: 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
  .card h2 { font-size: 17px; margin-bottom: 16px; color: #1e272e; }
  .status-row { display: flex; gap: 16px; flex-wrap: wrap; }
  .status-badge { padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; }
  .status-badge.running { background: #d2f4d3; color: #1a7a1e; }
  .status-badge.stopped { background: #ffeaa7; color: #8b7100; }
  .status-badge.error { background: #ffe0e0; color: #c0392b; }
  .kv { display: flex; flex-wrap: wrap; gap: 8px 24px; margin: 12px 0; }
  .kv-item { font-size: 14px; }
  .kv-item strong { color: #636e72; font-weight: 500; margin-right: 6px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 10px 12px; font-size: 14px; border-bottom: 1px solid #eee; }
  th { color: #636e72; font-weight: 600; font-size: 13px; background: #fafbfc; }
  .btn { padding: 7px 16px; border-radius: 6px; border: none; cursor: pointer; font-size: 13px; font-weight: 500; transition: all .15s; }
  .btn-primary { background: #1e272e; color: #fff; }
  .btn-primary:hover { background: #2d3a45; }
  .btn-danger { background: #e74c3c; color: #fff; }
  .btn-danger:hover { background: #c0392b; }
  .btn-success { background: #27ae60; color: #fff; }
  .btn-success:hover { background: #219a52; }
  .btn-warning { background: #f39c12; color: #fff; }
  .btn-warning:hover { background: #d68910; }
  .btn-sm { padding: 4px 12px; font-size: 12px; }
  .btn-outline { background: #fff; color: #1e272e; border: 1px solid #dcdde1; }
  .btn-outline:hover { background: #f5f6fa; }
  .btn-group { display: flex; gap: 8px; margin-top: 16px; }
  input, textarea { width: 100%; padding: 8px 12px; border: 1px solid #dcdde1; border-radius: 6px; font-size: 14px; font-family: inherit; }
  textarea { resize: vertical; min-height: 70px; }
  .field { margin-bottom: 14px; }
  .field label { display: block; font-size: 13px; color: #636e72; margin-bottom: 4px; font-weight: 500; }
  .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .toast { position: fixed; top: 20px; right: 20px; padding: 12px 20px; border-radius: 8px; color: #fff; font-size: 14px; z-index: 999; transition: opacity .3s; }
  .toast.success { background: #27ae60; }
  .toast.error { background: #e74c3c; }
  pre { background: #fafbfc; padding: 16px; border-radius: 6px; font-size: 13px; overflow-x: auto; max-height: 400px; overflow-y: auto; white-space: pre-wrap; word-break: break-all; }
  .hidden { display: none !important; }
  .empty { color: #b2bec3; font-size: 14px; padding: 20px 0; text-align: center; }
</style>
</head>
<body>
<div class="header">
  <h1>闲鱼自动回复 - 管理面板</h1>
  <div style="display:flex;align-items:center;gap:12px;">
    <button class="btn btn-success" id="btnServiceToggle" style="padding:8px 24px;font-size:15px;">启动服务</button>
    <span id="heartbeatStatus" style="font-size:13px;color:#a4b0be;">未启动</span>
  </div>
</div>
<div class="tabs">
  <button class="tab active" data-tab="products">商品管理</button>
  <button class="tab" data-tab="settings">系统设置</button>
  <button class="tab" data-tab="status">运行状态</button>
  <button class="tab" data-tab="logs">日志</button>
</div>
<div class="main">

  <!-- 商品管理 -->
  <div id="tab-products">
    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <h2 style="margin:0;">商品列表</h2>
        <button class="btn btn-primary" id="btnAddProduct">+ 添加商品</button>
      </div>
      <div id="productTable"></div>
      <div id="emptyProducts" class="empty hidden">暂无商品配置，点击"添加商品"开始。</div>
    </div>

    <!-- 编辑/新建弹窗内联 -->
    <div class="card hidden" id="editCard">
      <h2 id="editTitle">添加商品</h2>
      <div class="field">
        <label>商品ID (itemId)</label>
        <input id="editItemId" placeholder="如: 1023740460370">
      </div>
      <div class="field">
        <label>商品名称</label>
        <input id="editName" placeholder="如: 三角洲行动机密大坝单人护航">
      </div>
      <div class="field">
        <label>回复提示词 (每行一条)</label>
        <textarea id="editPrompt" placeholder="提示词内容..."></textarea>
      </div>
      <div class="field-row">
        <div class="field">
          <label>砍价底线比例 (floorRatio)</label>
          <input id="editFloorRatio" type="number" step="0.01" min="0" max="1" placeholder="0.9">
        </div>
        <div class="field">
          <label>砍价底线偏移 (floorOffset)</label>
          <input id="editFloorOffset" type="number" placeholder="0">
        </div>
      </div>
      <div class="btn-group">
        <button class="btn btn-primary" id="btnSaveProduct">保存</button>
        <button class="btn btn-outline" id="btnCancelEdit">取消</button>
      </div>
    </div>

    <!-- 默认设置 -->
    <div class="card">
      <h2>默认设置</h2>
      <div class="field">
        <label>全局默认提示词 (每行一条)</label>
        <textarea id="defaultPrompt" placeholder="所有商品公用的默认提示词..."></textarea>
      </div>
      <button class="btn btn-primary" id="btnSaveDefaults" style="margin-top:8px;">保存默认设置</button>
    </div>
  </div>

  <!-- 系统设置 -->
  <div id="tab-settings" class="hidden">
    <div class="card">
      <h2>DeepSeek API</h2>
      <div class="field">
        <label>API 密钥 (DEEPSEEK_API_KEY)</label>
        <input id="env_DEEPSEEK_API_KEY" type="password" placeholder="sk-...">
      </div>
      <div class="field">
        <label>API 地址 (DEEPSEEK_BASE_URL)</label>
        <input id="env_DEEPSEEK_BASE_URL" placeholder="https://api.deepseek.com">
      </div>
      <div class="field">
        <label>模型 (DEEPSEEK_MODEL)</label>
        <input id="env_DEEPSEEK_MODEL" placeholder="deepseek-v4-flash (或 deepseek-v4-pro)">
      </div>
    </div>

    <div class="card">
      <h2>闲鱼设置</h2>
      <div class="field">
        <label>消息页面地址 (XIANYU_MESSAGES_URL)</label>
        <input id="env_XIANYU_MESSAGES_URL" placeholder="https://www.goofish.com/im">
      </div>
      <div class="field-row">
        <div class="field">
          <label>轮询间隔 毫秒 (POLL_INTERVAL_MS)</label>
          <input id="env_POLL_INTERVAL_MS" type="number" placeholder="15000">
        </div>
        <div class="field">
          <label>自动发送 (AUTO_SEND)</label>
          <div style="display:flex;align-items:center;height:38px;">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:400;font-size:14px;">
              <input id="env_AUTO_SEND" type="checkbox" style="width:18px;height:18px;">
              启用自动发送回复
            </label>
          </div>
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label>最大历史消息数 (MAX_HISTORY_MESSAGES)</label>
          <input id="env_MAX_HISTORY_MESSAGES" type="number" placeholder="12">
        </div>
        <div class="field">
          <label>最大回复字数 (MAX_REPLY_CHARS)</label>
          <input id="env_MAX_REPLY_CHARS" type="number" placeholder="120">
        </div>
      </div>
    </div>

    <div class="card">
      <h2>浏览器设置</h2>
      <div class="field">
        <label>Chrome 路径 (CHROME_EXECUTABLE_PATH)</label>
        <input id="env_CHROME_EXECUTABLE_PATH" placeholder="留空使用系统默认">
      </div>
      <div class="field">
        <label>用户数据目录 (CHROME_USER_DATA_DIR)</label>
        <input id="env_CHROME_USER_DATA_DIR" placeholder="留空使用默认目录">
      </div>
      <div class="field-row">
        <div class="field">
          <label>Chrome 用户配置名 (CHROME_PROFILE)</label>
          <input id="env_CHROME_PROFILE" placeholder="Default">
        </div>
        <div class="field">
          <label>无头模式 (HEADLESS)</label>
          <div style="display:flex;align-items:center;height:38px;">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:400;font-size:14px;">
              <input id="env_HEADLESS" type="checkbox" style="width:18px;height:18px;">
              无界面模式运行
            </label>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>高级选项</h2>
      <div class="field-row">
        <div class="field">
          <label>打开对话重试次数 (OPEN_CONVERSATION_RETRY_COUNT)</label>
          <input id="env_OPEN_CONVERSATION_RETRY_COUNT" type="number" placeholder="8">
        </div>
        <div class="field">
          <label>重试间隔 毫秒 (OPEN_CONVERSATION_RETRY_DELAY_MS)</label>
          <input id="env_OPEN_CONVERSATION_RETRY_DELAY_MS" type="number" placeholder="800">
        </div>
      </div>
    </div>

    <div class="btn-group" style="justify-content:flex-end;">
      <button class="btn btn-outline" id="btnResetSettings">重置</button>
      <button class="btn btn-primary" id="btnSaveSettings">保存设置</button>
    </div>
    <div style="color:#e17055;font-size:13px;margin-top:12px;">注意：修改设置后需要重新点击「启动服务」才能生效。</div>
  </div>

  <!-- 运行状态 -->
  <div id="tab-status" class="hidden">
    <div class="card">
      <h2>心跳信息</h2>
      <div id="heartbeatInfo">加载中...</div>
    </div>
    <div class="card">
      <h2>回复记录</h2>
      <div id="stateInfo">加载中...</div>
    </div>
  </div>

  <!-- 日志 -->
  <div id="tab-logs" class="hidden">
    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <h2 style="margin:0;">最近日志 (最新200行)</h2>
        <button class="btn btn-outline btn-sm" id="btnRefreshLogs">刷新</button>
      </div>
      <pre id="logContent">加载中...</pre>
    </div>
  </div>
</div>

<div class="toast hidden" id="toast"></div>

<script>
let productsData = { defaults: { prompt: [], pricing: {} }, products: [] };
let editingIndex = -1; // -1 = 新建模式

function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

// Toast
function toast(msg, type) {
  const el = $("#toast");
  el.textContent = msg;
  el.className = "toast " + type;
  setTimeout(() => el.classList.add("hidden"), 2500);
}

// Tab 切换
$$(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    $$(".tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    const name = tab.dataset.tab;
    $$("#tab-products, #tab-settings, #tab-status, #tab-logs").forEach(el => el.classList.add("hidden"));
    $("#tab-" + name).classList.remove("hidden");
    if (name === "settings") { loadSettings(); }
    if (name === "status") { fetchHeartbeat(); fetchState(); }
    if (name === "logs") { fetchLogs(); }
  });
});

// ======== 商品管理 ========

async function loadProducts() {
  const res = await fetch("/api/products");
  productsData = await res.json();
  renderProductTable();
  $("#defaultPrompt").value = (productsData.defaults.prompt || []).join("\\n");
}

function renderProductTable() {
  const list = productsData.products || [];
  if (list.length === 0) {
    $("#productTable").innerHTML = "";
    $("#emptyProducts").classList.remove("hidden");
  } else {
    $("#emptyProducts").classList.add("hidden");
    let html = "<table><thead><tr><th>商品ID</th><th>名称</th><th>提示词</th><th>底价比例</th><th>底价偏移</th><th style='width:100px'>操作</th></tr></thead><tbody>";
    list.forEach((p, i) => {
      const prompt = (p.prompt || []).join(" / ");
      const pricing = p.pricing || {};
      const ratio = pricing.floorRatio != null ? pricing.floorRatio : "-";
      const offset = pricing.floorOffset != null ? pricing.floorOffset : "-";
      html += "<tr><td>" + esc(p.itemId || "") + "</td><td>" + esc(p.name || "") + "</td><td style='max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'>" + esc(prompt) + "</td><td>" + ratio + "</td><td>" + offset + "</td><td><button class='btn btn-outline btn-sm' onclick='editProduct(" + i + ")'>编辑</button> <button class='btn btn-danger btn-sm' onclick='deleteProduct(" + i + ")'>删除</button></td></tr>";
    });
    html += "</tbody></table>";
    $("#productTable").innerHTML = html;
  }
}

function esc(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

$("#btnAddProduct").addEventListener("click", () => {
  editingIndex = -1;
  $("#editTitle").textContent = "添加商品";
  $("#editItemId").value = "";
  $("#editName").value = "";
  $("#editPrompt").value = "";
  $("#editFloorRatio").value = "";
  $("#editFloorOffset").value = "";
  $("#editCard").classList.remove("hidden");
  $("#editCard").scrollIntoView({ behavior: "smooth" });
});

function editProduct(index) {
  const p = productsData.products[index];
  editingIndex = index;
  $("#editTitle").textContent = "编辑商品";
  $("#editItemId").value = p.itemId || "";
  $("#editName").value = p.name || "";
  $("#editPrompt").value = (p.prompt || []).join("\\n");
  $("#editFloorRatio").value = p.pricing?.floorRatio ?? "";
  $("#editFloorOffset").value = p.pricing?.floorOffset ?? "";
  $("#editCard").classList.remove("hidden");
  $("#editCard").scrollIntoView({ behavior: "smooth" });
}

$("#btnCancelEdit").addEventListener("click", () => {
  $("#editCard").classList.add("hidden");
});

$("#btnSaveProduct").addEventListener("click", async () => {
  const pricing = {};
  const floorRatioVal = $("#editFloorRatio").value.trim();
  const floorOffsetVal = $("#editFloorOffset").value.trim();
  if (floorRatioVal !== "") {
    const r = parseFloat(floorRatioVal);
    if (!Number.isNaN(r)) pricing.floorRatio = r;
  }
  if (floorOffsetVal !== "") {
    const o = parseFloat(floorOffsetVal);
    if (!Number.isNaN(o)) pricing.floorOffset = o;
  }
  const item = {
    itemId: $("#editItemId").value.trim(),
    name: $("#editName").value.trim(),
    prompt: $("#editPrompt").value.split("\\n").map(s => s.trim()).filter(Boolean)
  };
  if (Object.keys(pricing).length > 0) {
    item.pricing = pricing;
  }
  if (!item.itemId || !item.name) {
    toast("商品ID和名称不能为空", "error");
    return;
  }
  if (editingIndex >= 0) {
    productsData.products[editingIndex] = item;
  } else {
    productsData.products.push(item);
  }
  await saveProducts();
  $("#editCard").classList.add("hidden");
});

async function deleteProduct(index) {
  if (!confirm("确定删除该商品配置？")) return;
  productsData.products.splice(index, 1);
  await saveProducts();
}

$("#btnSaveDefaults").addEventListener("click", async () => {
  productsData.defaults.prompt = $("#defaultPrompt").value.split("\\n").map(s => s.trim()).filter(Boolean);
  await saveProducts();
});

async function saveProducts() {
  const res = await fetch("/api/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(productsData)
  });
  if (res.ok) {
    toast("保存成功", "success");
    renderProductTable();
  } else {
    toast("保存失败: " + (await res.text()), "error");
  }
}

// ======== 状态 ========

async function fetchHeartbeat() {
  try {
    const res = await fetch("/api/heartbeat");
    const data = await res.json();
    if (!data) {
      $("#heartbeatInfo").innerHTML = "<div class='empty'>暂无心跳数据</div>";
      return;
    }
    let html = "<div class='kv'>";
    html += "<div class='kv-item'><strong>状态</strong><span class='status-badge " + (data.status || "stopped") + "'>" + (data.status || "-") + "</span></div>";
    html += "<div class='kv-item'><strong>阶段</strong>" + (data.phase || "-") + "</div>";
    html += "<div class='kv-item'><strong>自动发送</strong>" + (data.autoSend ? "是" : "否") + "</div>";
    html += "<div class='kv-item'><strong>轮询间隔</strong>" + (data.pollIntervalMs || "-") + "ms</div>";
    html += "<div class='kv-item'><strong>最后对话</strong>" + (data.lastConversationId || "-") + "</div>";
    html += "<div class='kv-item'><strong>最后回复</strong>" + (data.lastReply || "-") + "</div>";
    if (data.error) html += "<div class='kv-item'><strong>错误</strong><span style='color:#e74c3c'>" + esc(data.error) + "</span></div>";
    html += "<div class='kv-item'><strong>时间</strong>" + (data.ts || "-") + "</div>";
    html += "</div>";
    $("#heartbeatInfo").innerHTML = html;
    const statusEl = $("#heartbeatStatus");
    if (data.status === "running") {
      statusEl.innerHTML = '<span class="status-badge running">运行中</span>';
    } else {
      statusEl.innerHTML = '<span class="status-badge stopped">' + (data.status || "已停止") + '</span>';
    }
  } catch (e) {
    $("#heartbeatInfo").innerHTML = "<div class='empty'>加载失败</div>";
  }
}

async function fetchState() {
  try {
    const res = await fetch("/api/state");
    const data = await res.json();
    if (!data || !data.replied || Object.keys(data.replied).length === 0) {
      $("#stateInfo").innerHTML = "<div class='empty'>暂无回复记录</div>";
      return;
    }
    let html = "<table><thead><tr><th>对话ID</th><th>消息指纹</th></tr></thead><tbody>";
    for (const [id, fp] of Object.entries(data.replied)) {
      html += "<tr><td>" + esc(id) + "</td><td style='max-width:500px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'>" + esc(fp) + "</td></tr>";
    }
    html += "</tbody></table>";
    $("#stateInfo").innerHTML = html;
  } catch (e) {
    $("#stateInfo").innerHTML = "<div class='empty'>加载失败</div>";
  }
}

// ======== 日志 ========

async function fetchLogs() {
  try {
    const res = await fetch("/api/logs");
    const data = await res.json();
    if (!data || data.lines.length === 0) {
      $("#logContent").textContent = "暂无日志。";
      return;
    }
    $("#logContent").textContent = data.lines.join("\\n");
  } catch (e) {
    $("#logContent").textContent = "加载失败。";
  }
}

$("#btnRefreshLogs").addEventListener("click", fetchLogs);

// ======== 系统设置 ========

const SETTINGS_FIELDS = [
  "DEEPSEEK_API_KEY",
  "DEEPSEEK_BASE_URL",
  "DEEPSEEK_MODEL",
  "XIANYU_MESSAGES_URL",
  "POLL_INTERVAL_MS",
  "AUTO_SEND",
  "MAX_HISTORY_MESSAGES",
  "MAX_REPLY_CHARS",
  "CHROME_EXECUTABLE_PATH",
  "CHROME_USER_DATA_DIR",
  "CHROME_PROFILE",
  "HEADLESS",
  "OPEN_CONVERSATION_RETRY_COUNT",
  "OPEN_CONVERSATION_RETRY_DELAY_MS"
];

async function loadSettings() {
  try {
    const res = await fetch("/api/settings");
    const data = await res.json();
    for (const key of SETTINGS_FIELDS) {
      const el = document.getElementById("env_" + key);
      if (!el) continue;
      const val = data[key] || "";
      if (el.type === "checkbox") {
        el.checked = val === "true" || val === "1" || val === "yes" || val === "on";
      } else {
        el.value = val;
      }
    }
  } catch (e) {
    toast("加载设置失败: " + e.message, "error");
  }
}

$("#btnSaveSettings").addEventListener("click", async () => {
  const settings = {};
  for (const key of SETTINGS_FIELDS) {
    const el = document.getElementById("env_" + key);
    if (!el) continue;
    if (el.type === "checkbox") {
      settings[key] = el.checked ? "true" : "false";
    } else {
      settings[key] = el.value.trim();
    }
  }
  const res = await fetch("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings)
  });
  if (res.ok) {
    toast("设置已保存，重新点击「启动服务」生效", "success");
  } else {
    const data = await res.json().catch(() => ({}));
    toast("保存失败: " + (data.error || "未知错误"), "error");
  }
});

$("#btnResetSettings").addEventListener("click", () => {
  loadSettings();
  toast("已重置为上次保存的值", "success");
});

// ======== 服务控制 ========

let serviceRunning = false;

async function updateServiceUI() {
  try {
    const res = await fetch("/api/heartbeat");
    const data = await res.json();
    serviceRunning = !!(data && data.serviceRunning);
  } catch (e) {
    serviceRunning = false;
  }
  const btn = $("#btnServiceToggle");
  const statusEl = $("#heartbeatStatus");
  if (serviceRunning) {
    btn.textContent = "停止服务";
    btn.className = "btn btn-warning";
    btn.style.cssText = "padding:8px 24px;font-size:15px;";
    statusEl.innerHTML = '<span class="status-badge running">运行中</span>';
  } else {
    btn.textContent = "启动服务";
    btn.className = "btn btn-success";
    btn.style.cssText = "padding:8px 24px;font-size:15px;";
    statusEl.innerHTML = '<span class="status-badge stopped">未启动</span>';
  }
}

$("#btnServiceToggle").addEventListener("click", async () => {
  await updateServiceUI(); // 先刷新状态
  if (serviceRunning) {
    if (!confirm("确定要停止自动回复服务吗？")) return;
    const res = await fetch("/api/service/stop", { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      toast(data.message || "服务已停止", "success");
    } else {
      toast("操作失败: " + (data.error || ""), "error");
    }
  } else {
    const btn = $("#btnServiceToggle");
    btn.textContent = "启动中...";
    btn.disabled = true;
    try {
      const res = await fetch("/api/service/start", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast(data.message || "服务已启动", "success");
      } else {
        toast("启动失败: " + (data.error || ""), "error");
      }
    } catch (e) {
      toast("启动失败: " + e.message, "error");
    }
    btn.disabled = false;
  }
  await updateServiceUI();
});

// 初始加载 & 定时刷新状态
loadProducts();
updateServiceUI();
fetchHeartbeat();
setInterval(() => {
  if (!$("#tab-status").classList.contains("hidden")) {
    fetchHeartbeat();
    fetchState();
  }
  updateServiceUI(); // 始终刷新顶部状态
}, 10000);
</script>
</body>
</html>`;
}

export function startAdminServer(projectRoot, serviceController) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    try {
      // GET / - HTML 页面
      if (req.method === "GET" && url.pathname === "/") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(buildHtmlPage());
        return;
      }

      // GET /api/products
      if (req.method === "GET" && url.pathname === "/api/products") {
        const data = readJSON(path.join(projectRoot, "products.json"), {
          defaults: { prompt: [], pricing: {} },
          products: []
        });
        jsonResponse(res, 200, data);
        return;
      }

      // POST /api/products
      if (req.method === "POST" && url.pathname === "/api/products") {
        let body = "";
        req.on("data", chunk => { body += chunk; });
        req.on("end", () => {
          try {
            const data = JSON.parse(body);
            fs.writeFileSync(
              path.join(projectRoot, "products.json"),
              JSON.stringify(data, null, 2),
              "utf8"
            );
            jsonResponse(res, 200, { ok: true });
          } catch (e) {
            jsonResponse(res, 400, { error: e.message });
          }
        });
        return;
      }

      // GET /api/state
      if (req.method === "GET" && url.pathname === "/api/state") {
        const data = readJSON(path.join(projectRoot, "state.json"), { replied: {} });
        jsonResponse(res, 200, data);
        return;
      }

      // GET /api/heartbeat
      if (req.method === "GET" && url.pathname === "/api/heartbeat") {
        const data = readJSON(path.join(projectRoot, "heartbeat.json"), null);
        const enriched = data
          ? { ...data, serviceRunning: serviceController.isRunning() }
          : { status: "idle", phase: "admin_ready", serviceRunning: false };
        jsonResponse(res, 200, enriched);
        return;
      }

      // POST /api/service/start
      if (req.method === "POST" && url.pathname === "/api/service/start") {
        if (serviceController.isRunning()) {
          jsonResponse(res, 200, { ok: true, message: "服务已在运行中" });
          return;
        }
        try {
          await serviceController.start();
          jsonResponse(res, 200, { ok: true, message: "服务已启动" });
        } catch (e) {
          jsonResponse(res, 500, { error: e.message });
        }
        return;
      }

      // POST /api/service/stop
      if (req.method === "POST" && url.pathname === "/api/service/stop") {
        serviceController.stop();
        jsonResponse(res, 200, { ok: true, message: "服务已停止" });
        return;
      }

      // GET /api/settings
      if (req.method === "GET" && url.pathname === "/api/settings") {
        const envFile = path.join(projectRoot, ".env");
        const data = {};
        if (fs.existsSync(envFile)) {
          const text = fs.readFileSync(envFile, "utf8");
          for (const line of text.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#")) continue;
            const idx = trimmed.indexOf("=");
            if (idx > 0) {
              data[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
            }
          }
        }
        jsonResponse(res, 200, data);
        return;
      }

      // POST /api/settings
      if (req.method === "POST" && url.pathname === "/api/settings") {
        let body = "";
        req.on("data", chunk => { body += chunk; });
        req.on("end", () => {
          try {
            const settings = JSON.parse(body);
            const envFile = path.join(projectRoot, ".env");
            // 保留 .env 中未在 UI 中展示的变量
            const existing = {};
            if (fs.existsSync(envFile)) {
              const text = fs.readFileSync(envFile, "utf8");
              for (const line of text.split("\n")) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith("#")) continue;
                const idx = trimmed.indexOf("=");
                if (idx > 0) {
                  const key = trimmed.slice(0, idx);
                  if (!(key in settings)) {
                    existing[key] = trimmed.slice(idx + 1);
                  }
                }
              }
            }
            const lines = [];
            for (const [key, value] of Object.entries(settings)) {
              lines.push(`${key}=${value}`);
            }
            for (const [key, value] of Object.entries(existing)) {
              lines.push(`${key}=${value}`);
            }
            fs.writeFileSync(envFile, lines.join("\n") + "\n", "utf8");
            jsonResponse(res, 200, { ok: true });
          } catch (e) {
            jsonResponse(res, 400, { error: e.message });
          }
        });
        return;
      }

      // GET /api/logs
      if (req.method === "GET" && url.pathname === "/api/logs") {
        const logFile = path.join(projectRoot, "runtime.log");
        if (!fs.existsSync(logFile)) {
          jsonResponse(res, 200, { lines: [] });
          return;
        }
        const text = fs.readFileSync(logFile, "utf8");
        const lines = text.trim().split("\n").slice(-200);
        jsonResponse(res, 200, { lines });
        return;
      }

      // 404
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found");
    } catch (e) {
      jsonResponse(res, 500, { error: e.message });
    }
  });

  const PORT = parseInt(process.env.ADMIN_PORT || "3456", 10);
  server.listen(PORT, "127.0.0.1", () => {
    console.log(`[ADMIN] 管理面板已启动: http://127.0.0.1:${PORT}`);
  });

  return server;
}
