import fs from "node:fs";
import { config } from "./config.js";
import { readHeartbeat } from "./heartbeat.js";

function readLastLogLine(file) {
  if (!fs.existsSync(file)) return null;
  const lines = fs.readFileSync(file, "utf8").trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return null;
  try {
    return JSON.parse(lines.at(-1));
  } catch {
    return { raw: lines.at(-1) };
  }
}

function main() {
  const heartbeat = readHeartbeat(config.paths.heartbeatFile);
  const lastLog = readLastLogLine(config.paths.logFile);
  const now = Date.now();
  const ttlMs = config.xianyu.pollIntervalMs * 3;
  const heartbeatTs = heartbeat?.ts ? new Date(heartbeat.ts).getTime() : 0;
  const running = Boolean(heartbeatTs && now - heartbeatTs <= ttlMs && heartbeat?.status !== "stopped");

  const payload = {
    running,
    now: new Date(now).toISOString(),
    ttlMs,
    heartbeat,
    lastLog
  };

  console.log(JSON.stringify(payload, null, 2));
  process.exitCode = running ? 0 : 1;
}

main();
