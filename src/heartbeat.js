import fs from "node:fs";

export function writeHeartbeat(file, payload) {
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        ts: new Date().toISOString(),
        ...payload
      },
      null,
      2
    ),
    "utf8"
  );
}

export function readHeartbeat(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
