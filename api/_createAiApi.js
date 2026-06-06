const crypto = require("node:crypto");

const CREATE_AI_CHATBOT_URL = "https://create-pied.vercel.app/api/messages";
const MAX_BODY_BYTES = 128 * 1024;
const API_SECRET = process.env.CREATE_AI_API_SECRET || "create-ai-api-demo-secret-change-me";

function sendJson(res, status, data) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(data);
}

function handleOptions(req, res) {
  if (req.method !== "OPTIONS") return false;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.status(204).end();
  return true;
}

function randomToken(length) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function signKeyPayload(keyId, secretPart) {
  return crypto
    .createHmac("sha256", API_SECRET)
    .update(`${keyId}.${secretPart}`)
    .digest("hex")
    .slice(0, 24);
}

function createApiKey() {
  const keyId = randomToken(8);
  const secretPart = randomToken(24);
  const signature = signKeyPayload(keyId, secretPart);
  return `cai-${keyId}-${secretPart}-${signature}`;
}

function maskKey(key) {
  return key ? `cai-xxxx...${key.slice(-4)}` : "cai-xxxx...xxxx";
}

function timingSafeEqualText(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function verifyApiKey(key) {
  const match = String(key || "").match(/^cai-([a-z0-9]{8})-([a-z0-9]{24})-([a-f0-9]{24})$/);

  if (!match) {
    return false;
  }

  const [, keyId, secretPart, signature] = match;
  return timingSafeEqualText(signKeyPayload(keyId, secretPart), signature);
}

function getBearerKey(req) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  if (typeof req.body === "string") {
    return JSON.parse(req.body || "{}");
  }

  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Request body is too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8") || "{}";
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Request body must be valid JSON."));
      }
    });

    req.on("error", reject);
  });
}

function cleanMessage(message) {
  const role = message?.role === "assistant" ? "assistant" : "user";
  const content = String(message?.content || message?.text || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1500);

  return content ? { role, content } : null;
}

function buildCreateAiPayload(body) {
  const messages = Array.isArray(body.messages) ? body.messages.map(cleanMessage).filter(Boolean) : [];
  const hasUserMessage = messages.some((message) => message.role === "user");

  if (!hasUserMessage) {
    throw new Error("Add a user message before calling Create_AI.");
  }

  return {
    model: String(body.model || "qwen3.5:cloud").slice(0, 80),
    max_tokens: Math.min(Number(body.max_tokens || 1000), 2000),
    system:
      "You are the Create_AI Assistant, a friendly, concise AI helper. Follow safety rules and be helpful, warm, and clear.",
    messages: messages.slice(-16)
  };
}

module.exports = {
  CREATE_AI_CHATBOT_URL,
  API_SECRET,
  buildCreateAiPayload,
  createApiKey,
  getBearerKey,
  handleOptions,
  maskKey,
  readJsonBody,
  sendJson,
  verifyApiKey
};
