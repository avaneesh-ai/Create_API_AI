const {
  CREATE_AI_CHATBOT_URL,
  createApiKey,
  handleOptions,
  maskKey,
  readJsonBody,
  sendJson
} = require("./_createAiApi");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;

  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Use POST to create an API key." });
    return;
  }

  try {
    await readJsonBody(req);
    const key = createApiKey();

    sendJson(res, 201, {
      key,
      masked: maskKey(key),
      powered_by: CREATE_AI_CHATBOT_URL,
      key_mode: "signed-self-verifying",
      note: "The full key is shown once. Store it securely."
    });
  } catch (error) {
    sendJson(res, 400, { error: error.message });
  }
};
