import fs from "node:fs";

export function loadState(file) {
  if (!fs.existsSync(file)) {
    return { replied: {} };
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function saveState(file, state) {
  fs.writeFileSync(file, JSON.stringify(state, null, 2), "utf8");
}

export function hasReplied(state, conversationId, fingerprint) {
  return state.replied[conversationId] === fingerprint;
}

export function markReplied(state, conversationId, fingerprint) {
  state.replied[conversationId] = fingerprint;
}
