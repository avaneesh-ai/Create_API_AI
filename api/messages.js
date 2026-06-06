const {
  CREATE_AI_CHATBOT_URL,
  buildCreateAiPayload,
  getBearerKey,
  handleOptions,
  readJsonBody,
  sendJson,
  verifyApiKey
} = require("./_createAiApi");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;

  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Use POST for Create_AI_API messages." });
    return;
  }

  if (!verifyApiKey(getBearerKey(req))) {
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
};
