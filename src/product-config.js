import fs from "node:fs";

function normalizeUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value, "https://www.goofish.com");
    url.hash = "";
    return url.toString();
  } catch {
    return value.trim();
  }
}

export function loadProductConfig(filePath) {
  if (!fs.existsSync(filePath)) {
    return {
      defaults: { prompt: [], pricing: {} },
      products: []
    };
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return {
    defaults: {
      prompt: Array.isArray(parsed.defaults?.prompt) ? parsed.defaults.prompt : [],
      pricing: parsed.defaults?.pricing || {}
    },
    products: Array.isArray(parsed.products) ? parsed.products : []
  };
}

export function resolveProductProfile(store, context) {
  const itemId = context.itemId || "";
  const itemUrl = normalizeUrl(context.itemUrl || "");

  const byId = store.products.find((entry) => entry.itemId && entry.itemId === itemId);
  if (byId) {
    return byId;
  }

  const byUrl = store.products.find((entry) => {
    if (!entry.itemUrl) return false;
    return normalizeUrl(entry.itemUrl) === itemUrl;
  });
  if (byUrl) {
    return byUrl;
  }

  return null;
}
