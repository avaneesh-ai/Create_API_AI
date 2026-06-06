const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const PORT = Number(process.env.PORT || 4174);
const HOST = process.env.HOST || "127.0.0.1";
const ROOT = __dirname;
const CREATE_AI_CHATBOT_URL = "https://create-pied.vercel.app/api/messages";
const MAX_BODY_BYTES = 128 * 1024;
const keyHashes = new Map();

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function sendStatic(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = mimeTypes[ext] || "application/octet-stream";

  fs.readFile(filePath, (error, data) => {
    if (error) {
      sendJson(res, 404, { error: "File not found." });
      return;
    }

    res.writeHead(200, {
      "Content-Type": type,
      "Cache-Control": "public, max-age=0, must-revalidate"
    });
    res.end(data);
  });
}

function readJsonBody(req) {
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

function generateToken(length) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function createApiKey() {
  return `cai-${generateToken(8)}-${generateToken(8)}-${generateToken(8)}-${generateToken(8)}`;
}

function hashKey(key) {
  return crypto.createHash("sha256").update(key, "utf8").digest("hex");
}

function getBearerKey(req) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function verifyKey(req) {
  const key = getBearerKey(req);
  if (!key) return false;
  return keyHashes.has(hashKey(key));
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

async function handleCreateKey(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Use POST to create an API key." });
    return;
  }

  try {
    await readJsonBody(req);
    const key = createApiKey();
    const keyHash = hashKey(key);
    keyHashes.set(keyHash, {
      createdAt: new Date().toISOString(),
      upstream: CREATE_AI_CHATBOT_URL
    });

    sendJson(res, 201, {
      key,
      masked: `cai-xxxx...${key.slice(-4)}`,
      powered_by: CREATE_AI_CHATBOT_URL
    });
  } catch (error) {
    sendJson(res, 400, { error: error.message });
  }
}

async function handleMessages(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Use POST for Create_AI_API messages." });
    return;
  }

  if (!verifyKey(req)) {
    sendJson(res, 401, { error: "Missing or invalid Create_AI_API key." });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const payload = buildCreateAiPayload(body);
    const upstream = await fetch(CREATE_AI_CHATBOT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      sendJson(res, upstream.status, {
        error: data.error || "Create_AI chatbot did not accept the request.",
        powered_by: CREATE_AI_CHATBOT_URL
      });
      return;
    }

    sendJson(res, 200, {
      ...data,
      powered_by: CREATE_AI_CHATBOT_URL
    });
  } catch (error) {
    sendJson(res, 400, { error: error.message });
  }
}

function handleStatic(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const safePath = path.normalize(pathname).replace(/^[/\\]+/, "").replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(ROOT, safePath);

  if (!filePath.startsWith(ROOT)) {
    sendJson(res, 403, { error: "Forbidden." });
    return;
  }

  sendStatic(res, filePath);
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith("/api/keys")) {
    handleCreateKey(req, res);
    return;
  }

  if (req.url.startsWith("/api/messages")) {
    handleMessages(req, res);
    return;
  }

  if (req.url.startsWith("/api/health")) {
    sendJson(res, 200, {
      ok: true,
      keys: keyHashes.size,
      powered_by: CREATE_AI_CHATBOT_URL
    });
    return;
  }

  handleStatic(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`Create_AI_API running at http://${HOST}:${PORT}/`);
});
