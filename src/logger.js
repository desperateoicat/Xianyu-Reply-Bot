import fs from "node:fs";

export function createLogger(logFile) {
  function write(level, message, extra) {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      message,
      extra: extra ?? null
    });
    fs.appendFileSync(logFile, `${line}\n`, "utf8");
    console.log(`[${level}] ${message}`);
    if (extra) {
      console.log(extra);
    }
  }

  return {
    info(message, extra) {
      write("INFO", message, extra);
    },
    warn(message, extra) {
      write("WARN", message, extra);
    },
    error(message, extra) {
      write("ERROR", message, extra);
    }
  };
}
