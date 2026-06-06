const { API_SECRET, CREATE_AI_CHATBOT_URL, handleOptions, sendJson } = require("./_createAiApi");

module.exports = function handler(req, res) {
  if (handleOptions(req, res)) return;

  sendJson(res, 200, {
    ok: true,
    app: "Create_AI_API",
    routes: ["/api/keys", "/api/messages", "/api/health"],
    key_mode: "signed-self-verifying",
    production_secret_configured: API_SECRET !== "create-ai-api-demo-secret-change-me",
    powered_by: CREATE_AI_CHATBOT_URL
  });
};
