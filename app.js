(() => {
  const app = document.getElementById("app");
  const toast = document.getElementById("toast");
  const CREATE_AI_CHATBOT_URL = "https://create-pied.vercel.app/api/messages";
  const LOCAL_SERVER_ORIGIN = "http://127.0.0.1:4174";
  const IDLE_MS = 2 * 60 * 1000;

  const models = [
    { id: "qwen3.5:cloud", label: "Qwen3.5 Cloud" },
    { id: "qwen3-vl:235b-cloud", label: "Qwen3-VL 235B Cloud" },
    { id: "qwen3-coder:480b-cloud", label: "Qwen3-Coder Cloud" },
    { id: "qwen3", label: "Qwen3 Local/Cloud" }
  ];

  const promptChips = [
    { label: "Explain", text: "Explain how to call the Create_AI API safely." },
    { label: "Write", text: "Write a short API integration example for my app." },
    { label: "Ideas", text: "Give me product ideas that use a Create_AI chatbot." },
    { label: "Plan", text: "Plan the backend needed to protect API keys and user data." }
  ];

  const stepOrder = ["account", "profile", "emailSent", "confirm"];
  let passwordScratch = "";
  let idleTimer = null;
  let toastTimer = null;

  const createInitialState = () => ({
    step: "account",
    account: { email: "" },
    profile: { name: "", mobile: "" },
    apiKey: "",
    apiKeyStatus: "empty",
    apiKeySource: "",
    keyVisible: false,
    locked: false,
    logoutOpen: false,
    chatBusy: false,
    connection: "ready",
    model: "qwen3.5:cloud",
    lastRequest: null,
    messages: [
      {
        role: "assistant",
        text:
          "Create_AI_API is ready. Create a key, then messages are sent through that key to the Create_AI chatbot without adding your email, name, or mobile."
      }
    ]
  });

  let state = createInitialState();

  const icons = {
    arrowRight:
      '<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>',
    check:
      '<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m20 6-11 11-5-5"/></svg>',
    copy:
      '<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    eye:
      '<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff:
      '<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 2 20 20"/><path d="M6.7 6.7C3.9 8.6 2 12 2 12s3.5 7 10 7c1.7 0 3.2-.5 4.4-1.2"/><path d="M10.5 5.1c.5-.1 1-.1 1.5-.1 6.5 0 10 7 10 7s-1 2-2.8 3.8"/><path d="M14.1 14.1A3 3 0 0 1 9.9 9.9"/></svg>',
    key:
      '<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="14.5" r="5.5"/><path d="m12 10 9-9"/><path d="m16 5 3 3"/><path d="m19 2 2 2"/></svg>',
    lock:
      '<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    logout:
      '<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>',
    refresh:
      '<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 1-14.8 6.9"/><path d="M3 12A9 9 0 0 1 17.8 5.1"/><path d="M21 3v6h-6"/><path d="M3 21v-6h6"/></svg>',
    send:
      '<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>',
    shield:
      '<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3Z"/><path d="m9 12 2 2 4-5"/></svg>',
    user:
      '<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21a7 7 0 0 0-14 0"/><circle cx="12" cy="8" r="4"/></svg>'
  };

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function wipePassword() {
    passwordScratch = "";
    const passwordInput = document.getElementById("password");
    if (passwordInput) {
      passwordInput.value = "";
    }
  }

  function maskEmail(email) {
    const [name = "", domain = ""] = String(email).split("@");
    if (!domain) return "masked email";
    const visibleStart = name.slice(0, 1);
    const visibleEnd = name.length > 2 ? name.slice(-1) : "";
    return `${visibleStart}${"*".repeat(Math.max(3, name.length - 2))}${visibleEnd}@${domain}`;
  }

  function normalizeMobile(value) {
    return String(value).replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
  }

  function generateToken(length) {
    const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  }

  function generateApiKey() {
    return `cai-${generateToken(8)}-${generateToken(8)}-${generateToken(8)}-${generateToken(8)}`;
  }

  function getServerOrigin() {
    if (window.location.protocol === "file:") return LOCAL_SERVER_ORIGIN;
    return window.location.origin;
  }

  function getKeyEndpoint() {
    if (window.location.protocol === "file:") return `${LOCAL_SERVER_ORIGIN}/api/keys`;
    return "/api/keys";
  }

  function getProxyEndpoint() {
    if (window.location.protocol === "file:") return `${LOCAL_SERVER_ORIGIN}/api/messages`;
    return "/api/messages";
  }

  function getSnippetEndpoint() {
    return `${getServerOrigin()}/api/messages`;
  }

  function renderLogoMark(label = "") {
    const alt = label ? ` alt="${escapeHtml(label)}"` : ' alt=""';
    return `<div class="logo-mark"><img src="./create-ai-logo.png"${alt} /></div>`;
  }

  function maskKey(key) {
    if (!key) return "cai-xxxx...xxxx";
    return `cai-xxxx...${key.slice(-4)}`;
  }

  function fullSnippet(key) {
    return `curl ${getSnippetEndpoint()} \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "qwen3.5:cloud",
    "max_tokens": 1000,
    "messages": [
      { "role": "user", "content": "YOUR_MESSAGE" }
    ]
  }'`;
  }

  function displaySnippet() {
    return fullSnippet(maskKey(state.apiKey));
  }

  function getModelLabel(id = state.model) {
    return models.find((model) => model.id === id)?.label || "Qwen3.5 Cloud";
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("show");
    toastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 2200);
  }

  async function copyText(value, message) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = value;
        textArea.setAttribute("readonly", "readonly");
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      showToast(message);
    } catch (error) {
      showToast("Copy was blocked by the browser.");
    }
  }

  async function createApiKeyFromServer() {
    const response = await fetch(getKeyEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app: "Create_AI_API",
        upstream: CREATE_AI_CHATBOT_URL
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.key) {
      throw new Error(data.error || "Create_AI_API key server is not available.");
    }

    return data.key;
  }

  async function provisionApiKey() {
    state.apiKeyStatus = "creating";
    state.apiKeySource = "";
    render();

    try {
      state.apiKey = await createApiKeyFromServer();
      state.apiKeyStatus = "active";
      state.apiKeySource = "server";
      state.keyVisible = false;
      state.connection = "live";
      showToast("Create_AI_API key created.");
    } catch (error) {
      state.apiKey = generateApiKey();
      state.apiKeyStatus = "local";
      state.apiKeySource = "browser";
      state.keyVisible = false;
      state.connection = "preview";
      showToast("Preview key created. Run the server for real key validation.");
    }
  }

  function createAssistantReply(text, errorMessage = "") {
    const lower = text.toLowerCase();
    const model = getModelLabel();
    const prefix = errorMessage
      ? `${model}: I could not reach the Create_AI_API proxy this time (${errorMessage}). `
      : `${model}: `;

    if (lower.includes("backend") || lower.includes("protect") || lower.includes("safe")) {
      return `${prefix}Use the backend proxy flow: store only key hashes, verify the Bearer key on /api/messages, then forward the model and messages to the Create_AI chatbot without adding email, name, or mobile.`;
    }

    if (lower.includes("code") || lower.includes("curl") || lower.includes("example")) {
      return `${prefix}Call ${getSnippetEndpoint()} with Authorization: Bearer ${maskKey(state.apiKey)}. Create_AI_API verifies that key before forwarding to ${CREATE_AI_CHATBOT_URL}.`;
    }

    if (lower.includes("idea")) {
      return `${prefix}Good fits include a support assistant, a product search helper, a code explainer, and an onboarding guide. Each app can call Create_AI_API with its own scoped key.`;
    }

    return `${prefix}I can help with that. This app sends only the selected model and chat messages through the generated API key.`;
  }

  function getChatHistoryForApi(extraMessage = "") {
    const messages = state.messages
      .filter((message) => !message.pending)
      .filter((message) => message.role === "user" || message.role === "assistant")
      .map((message) => ({ role: message.role, content: message.text }));

    if (extraMessage) {
      messages.push({ role: "user", content: extraMessage });
    }

    return messages.slice(-16);
  }

  function buildChatPayload(extraMessage = "") {
    return {
      model: state.model,
      max_tokens: 1000,
      system:
        "You are the Create_AI Assistant, a friendly, concise AI helper. Follow safety rules and be helpful, warm, and clear.",
      messages: getChatHistoryForApi(extraMessage)
    };
  }

  function buildRequestPreview(message) {
    return {
      endpoint: getSnippetEndpoint(),
      powered_by: CREATE_AI_CHATBOT_URL,
      method: "POST",
      headers: {
        Authorization: `Bearer ${maskKey(state.apiKey)}`,
        "Content-Type": "application/json"
      },
      body: buildChatPayload(message)
    };
  }

  function extractAssistantText(data) {
    if (typeof data?.output_text === "string" && data.output_text.trim()) {
      return data.output_text.trim();
    }

    if (typeof data?.text === "string" && data.text.trim()) {
      return data.text.trim();
    }

    if (typeof data?.message === "string" && data.message.trim()) {
      return data.message.trim();
    }

    if (Array.isArray(data?.content)) {
      return data.content
        .filter((item) => item?.type === "text" && item.text)
        .map((item) => item.text)
        .join("\n")
        .trim();
    }

    return "";
  }

  async function callCreateAiApi(message) {
    const response = await fetch(getProxyEndpoint(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${state.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(buildChatPayload(message))
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || "Create_AI chatbot request failed.");
    }

    const text = extractAssistantText(data);

    if (!text) {
      throw new Error("Create_AI chatbot returned an empty reply.");
    }

    return text;
  }

  function clearSensitiveState() {
    wipePassword();
    clearTimeout(idleTimer);
    state = createInitialState();
  }

  function armIdleLock() {
    clearTimeout(idleTimer);
    if (state.step !== "workspace" || state.locked || state.logoutOpen) return;

    idleTimer = setTimeout(() => {
      state.locked = true;
      render();
    }, IDLE_MS);
  }

  function noteActivity() {
    if (state.step === "workspace" && !state.locked && !state.logoutOpen) {
      armIdleLock();
    }
  }

  ["pointerdown", "keydown", "input", "scroll", "mousemove", "touchstart"].forEach((eventName) => {
    document.addEventListener(eventName, noteActivity, { passive: true });
  });

  function renderBrandPanel() {
    return `
      <aside class="brand-panel">
        <div class="brand-lockup">
          ${renderLogoMark("Create_AI logo")}
          <div>
            <p class="brand-name">Create_AI_API</p>
            <p class="brand-subtitle">Key access for Create_AI chatbots</p>
          </div>
        </div>

        <div class="hero-copy">
          <p class="eyebrow">Powered by Create_AI chatbot</p>
          <h1>Create AI API</h1>
          <p>Register, create a masked API key, and use it to call Create_AI_API. The backend validates the key and forwards chat requests to Create_AI.</p>
        </div>

        <ul class="trust-list" aria-label="Safety highlights">
          <li><span class="trust-icon">${icons.shield}</span><span>Password memory is wiped after the account step.</span></li>
          <li><span class="trust-icon">${icons.key}</span><span>Generated keys unlock the Create_AI chatbot proxy.</span></li>
          <li><span class="trust-icon">${icons.lock}</span><span>Idle sessions lock after two minutes.</span></li>
        </ul>
      </aside>
    `;
  }

  function renderStepMeter() {
    const current = stepOrder.indexOf(state.step);
    return `
      <div class="step-meter" aria-label="Signup progress">
        ${stepOrder
          .map((_, index) => `<span class="step-dot ${index <= current ? "active" : ""}"></span>`)
          .join("")}
      </div>
    `;
  }

  function renderAccountStep() {
    return `
      <div class="flow-header">
        <div>
          <h2 class="flow-title">Create your account</h2>
          <p class="flow-copy">Start with the same eight-character minimum used by Create_AI. The password is used only for this step.</p>
        </div>
        ${renderStepMeter()}
      </div>

      <form class="form-stack" id="accountForm" novalidate>
        <div class="field">
          <label for="email">Email</label>
          <input id="email" type="email" autocomplete="email" value="${escapeHtml(state.account.email)}" placeholder="you@example.com" />
          <div class="error-text" id="emailError"></div>
        </div>

        <div class="field">
          <label for="password">Password</label>
          <input id="password" type="password" autocomplete="new-password" placeholder="At least 8 characters" />
          <div class="error-text" id="passwordError"></div>
        </div>

        <div class="actions-row">
          <button class="button primary" type="submit">Next ${icons.arrowRight}</button>
        </div>
      </form>
    `;
  }

  function renderProfileStep() {
    return `
      <div class="flow-header">
        <div>
          <h2 class="flow-title">Add your details</h2>
          <p class="flow-copy">Name and mobile stay inside this browser session and are never added to Create_AI chatbot requests.</p>
        </div>
        ${renderStepMeter()}
      </div>

      <form class="form-stack" id="profileForm" novalidate>
        <div class="field">
          <label for="name">Name</label>
          <input id="name" type="text" autocomplete="name" value="${escapeHtml(state.profile.name)}" placeholder="Your name" />
          <div class="error-text" id="nameError"></div>
        </div>

        <div class="field">
          <label for="mobile">Mobile number</label>
          <input id="mobile" type="tel" autocomplete="tel" value="${escapeHtml(state.profile.mobile)}" placeholder="+91 98765 43210" />
          <div class="error-text" id="mobileError"></div>
        </div>

        <div class="actions-row">
          <button class="button ghost" type="button" id="backToAccount">Back</button>
          <button class="button primary" type="submit">Send login link ${icons.arrowRight}</button>
        </div>
      </form>
    `;
  }

  function renderEmailSentStep() {
    return `
      <div class="flow-header">
        <div>
          <h2 class="flow-title">Email sent</h2>
          <p class="flow-copy">A Create_AI confirmation message is waiting for ${escapeHtml(maskEmail(state.account.email))}.</p>
        </div>
        ${renderStepMeter()}
      </div>

      <div class="inbox">
        <div class="inbox-logo">${renderLogoMark("Create_AI logo")}</div>
        <div>
          <h3>Create_AI login link</h3>
          <p>Open the secure login link to continue into Create_AI_API.</p>
        </div>
      </div>

      <div class="actions-row">
        <button class="button ghost" type="button" id="backToProfile">Back</button>
        <button class="button primary" type="button" id="openLoginLink">Open your login link ${icons.arrowRight}</button>
      </div>
    `;
  }

  function renderConfirmStep() {
    return `
      <div class="flow-header">
        <div>
          <h2 class="flow-title">Confirm login</h2>
          <p class="flow-copy">The request is for ${escapeHtml(maskEmail(state.account.email))}.</p>
        </div>
        ${renderStepMeter()}
      </div>

      <div class="confirmation-card">
        <strong>Do you want to login to this app?</strong>
        <p>Create_AI_API will create a masked API key that powers calls to the Create_AI chatbot.</p>
      </div>

      <div class="actions-row">
        <button class="button ghost" type="button" id="backToEmail">Back</button>
        <button class="button primary" type="button" id="enterWorkspace">Okay ${icons.check}</button>
      </div>
    `;
  }

  function renderFlowPanel() {
    const steps = {
      account: renderAccountStep,
      profile: renderProfileStep,
      emailSent: renderEmailSentStep,
      confirm: renderConfirmStep
    };

    return `<main class="flow-panel">${steps[state.step]()}</main>`;
  }

  function renderStage() {
    return `<section class="stage">${renderBrandPanel()}${renderFlowPanel()}</section>`;
  }

  function renderKeyPanel() {
    const hasKey = Boolean(state.apiKey);
    const shownKey = hasKey ? (state.keyVisible ? state.apiKey : maskKey(state.apiKey)) : "Creating API key...";
    const disabled = hasKey ? "" : "disabled";
    const keySource =
      state.apiKeySource === "server"
        ? "Server-created key. Stored server-side as a hash and used to authorize the chatbot proxy."
        : state.apiKeySource === "browser"
          ? "Preview key. Start the Create_AI_API server to validate keys before chatbot access."
          : "Creating a Create_AI_API key.";

    return `
      <section class="workspace-panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">API key</h2>
            <p class="panel-copy">${keySource}</p>
          </div>
          <span class="status-dot ${state.apiKeySource === "server" ? "live" : ""}" title="Create_AI_API key">${icons.key}</span>
        </div>

        <div class="key-box">
          <div class="key-value" id="keyValue">${escapeHtml(shownKey)}</div>
          <div class="key-actions">
            <button class="button small" type="button" id="toggleKey" title="${state.keyVisible ? "Hide key" : "Show key"}" ${disabled}>
              ${state.keyVisible ? icons.eyeOff : icons.eye}
              ${state.keyVisible ? "Hide" : "Show"}
            </button>
            <button class="button small" type="button" id="copyKey" title="Copy API key" ${disabled}>${icons.copy} Copy</button>
            <button class="button small" type="button" id="regenerateKey" title="Regenerate API key">${icons.refresh} Regenerate</button>
          </div>
        </div>
      </section>
    `;
  }

  function renderSnippetPanel() {
    return `
      <section class="workspace-panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">Use it in your app</h2>
            <p class="panel-copy">Apps call Create_AI_API with this key. Create_AI_API then forwards to the Create_AI chatbot.</p>
          </div>
        </div>
        <div class="code-box">
          <div class="code-toolbar">
            <span>curl</span>
            <button class="button small" type="button" id="copySnippet" title="Copy snippet">${icons.copy} Copy</button>
          </div>
          <pre>${escapeHtml(displaySnippet())}</pre>
        </div>
      </section>
    `;
  }

  function renderPrivacyPanel() {
    return `
      <section class="utility-panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">Security & privacy</h2>
            <p class="panel-copy">Browser-side protections are active in this demo. Production safety still belongs on the backend.</p>
          </div>
          <span class="status-dot">${icons.shield}</span>
        </div>

        <ul class="privacy-grid">
          <li><span class="status-dot">${icons.check}</span><span><strong>Password wiped:</strong> the password field and temporary variable are cleared after account validation.</span></li>
          <li><span class="status-dot">${icons.check}</span><span><strong>Local details:</strong> email, name, and mobile are not persisted and are not added to Create_AI chatbot payloads.</span></li>
          <li><span class="status-dot">${icons.check}</span><span><strong>Masked key:</strong> the API key and code snippet hide the secret on screen, while copy uses the real key.</span></li>
          <li><span class="status-dot">${icons.check}</span><span><strong>Powered key:</strong> server-created keys authorize the local proxy before it calls ${CREATE_AI_CHATBOT_URL}.</span></li>
          <li><span class="status-dot">${icons.check}</span><span><strong>Auto-lock:</strong> inactivity covers the workspace after two minutes.</span></li>
          <li><span class="status-dot">${icons.check}</span><span><strong>Logout wipe:</strong> local details, key, and chat history are cleared together.</span></li>
        </ul>

        <ul class="backend-list" aria-label="Production backend requirements">
          <li>Use bcrypt, argon2, or scrypt for passwords.</li>
          <li>Encrypt personal data at rest.</li>
          <li>Store only API key hashes and reveal the key once. This local server does that in memory.</li>
          <li>Use HTTPS, secure cookies, rate limits, and clean logs.</li>
        </ul>
      </section>
    `;
  }

  function renderChatPanel() {
    const modelOptions = models
      .map(
        (model) =>
          `<option value="${model.id}" ${model.id === state.model ? "selected" : ""}>${model.label}</option>`
      )
      .join("");

    const chips = promptChips
      .map((chip) => `<button class="chip" type="button" data-prompt="${escapeHtml(chip.text)}">${chip.label}</button>`)
      .join("");

    const messages = state.messages
      .map(
        (message) => `
          <div class="message ${message.role} ${message.pending ? "pending" : ""}">
            <small>${message.role === "user" ? "You" : "Create_AI"}</small>
            ${escapeHtml(message.text)}
          </div>
        `
      )
      .join("");

    const requestPreview = state.lastRequest
      ? `<details class="request-preview">
          <summary>Last chatbot request</summary>
          <pre>${escapeHtml(JSON.stringify(state.lastRequest, null, 2))}</pre>
        </details>`
      : "";

    return `
      <section class="workspace-panel chat-panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">AI Chatbot</h2>
            <p class="panel-copy">Powered by Create_AI through your generated API key. The request preview excludes email, name, and mobile.</p>
          </div>
          <span class="connection-pill ${state.connection === "live" ? "live" : ""}">
            ${state.connection === "live" ? "Live proxy" : "Preview"}
          </span>
        </div>

        <div class="chat-controls">
          <label class="field">
            <span class="control-label">Model</span>
            <select class="select-control" id="modelSelect">${modelOptions}</select>
          </label>
          <div>
            <span class="control-label">Prompt</span>
            <div class="chip-row">${chips}</div>
          </div>
        </div>

        <div class="chat-stream" id="chatStream">${messages}</div>

        <form class="chat-form" id="chatForm">
          <label class="field">
            <span class="sr-only">Message</span>
            <textarea id="chatInput" placeholder="Ask Create_AI anything" ${state.chatBusy ? "disabled" : ""}></textarea>
          </label>
          <button class="button primary send" type="submit" ${state.chatBusy || !state.apiKey ? "disabled" : ""}>${icons.send} ${state.chatBusy ? "Sending" : "Send"}</button>
        </form>
        ${requestPreview}
      </section>
    `;
  }

  function renderWorkspace() {
    return `
      <section class="workspace">
        <header class="workspace-header">
          <div class="workspace-heading">
            ${renderLogoMark("Create_AI logo")}
            <div>
              <h1 class="workspace-title">Create_AI_API workspace</h1>
              <p class="workspace-meta">${escapeHtml(state.profile.name)} / ${escapeHtml(maskEmail(state.account.email))}</p>
            </div>
          </div>
          <div class="header-actions">
            <button class="button icon" type="button" id="lockNow" title="Lock session">${icons.lock}<span class="sr-only">Lock session</span></button>
            <button class="button icon" type="button" id="logout" title="Log out">${icons.logout}<span class="sr-only">Log out</span></button>
          </div>
        </header>

        <div class="workspace-grid">
          <div class="left-stack">
            ${renderKeyPanel()}
            ${renderSnippetPanel()}
            ${renderPrivacyPanel()}
          </div>
          <div class="right-stack">
            ${renderChatPanel()}
          </div>
        </div>
      </section>
      ${state.locked ? renderLockOverlay() : ""}
      ${state.logoutOpen ? renderLogoutModal() : ""}
    `;
  }

  function renderLockOverlay() {
    return `
      <div class="screen" role="dialog" aria-modal="true" aria-labelledby="lockTitle">
        <div class="lock-panel">
          <div class="brand-lockup">
            ${renderLogoMark("Create_AI logo")}
            <div>
              <p class="brand-name">Create_AI_API</p>
              <p class="brand-subtitle">Locked session</p>
            </div>
          </div>
          <h2 id="lockTitle">Session locked</h2>
          <p>The workspace is covered for ${escapeHtml(maskEmail(state.account.email))}. A production app would re-check the server session here.</p>
          <div class="modal-actions">
            <button class="button primary" type="button" id="unlock">${icons.lock} Unlock workspace</button>
            <button class="button danger" type="button" id="lockedLogout">${icons.logout} Log out</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderLogoutModal() {
    return `
      <div class="screen" role="dialog" aria-modal="true" aria-labelledby="logoutTitle">
        <div class="modal-panel">
          <h2 id="logoutTitle">Log out?</h2>
          <p>This will clear local details for ${escapeHtml(maskEmail(state.account.email))}, remove the API key, and wipe chat history.</p>
          <div class="modal-actions">
            <button class="button ghost" type="button" id="cancelLogout">Cancel</button>
            <button class="button danger" type="button" id="confirmLogout">${icons.logout} Log out and wipe</button>
          </div>
        </div>
      </div>
    `;
  }

  function render() {
    app.innerHTML = state.step === "workspace" ? renderWorkspace() : renderStage();
    bindEvents();
    if (state.step === "workspace") {
      armIdleLock();
      requestAnimationFrame(() => {
        const stream = document.getElementById("chatStream");
        if (stream) stream.scrollTop = stream.scrollHeight;
      });
    }
  }

  function bindEvents() {
    const accountForm = document.getElementById("accountForm");
    if (accountForm) {
      const emailInput = document.getElementById("email");
      const passwordInput = document.getElementById("password");

      emailInput?.addEventListener("input", () => {
        state.account.email = emailInput.value.trim();
      });

      passwordInput?.addEventListener("input", () => {
        passwordScratch = passwordInput.value;
      });

      accountForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const emailError = document.getElementById("emailError");
        const passwordError = document.getElementById("passwordError");
        const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        const passwordOk = password.length >= 8;

        emailError.textContent = emailOk ? "" : "Enter a valid email address.";
        passwordError.textContent = passwordOk ? "" : "Password must be at least 8 characters.";

        if (!emailOk || !passwordOk) return;

        state.account.email = email;
        wipePassword();
        state.step = "profile";
        render();
      });
    }

    const profileForm = document.getElementById("profileForm");
    if (profileForm) {
      const nameInput = document.getElementById("name");
      const mobileInput = document.getElementById("mobile");

      nameInput?.addEventListener("input", () => {
        state.profile.name = nameInput.value.trimStart();
      });

      mobileInput?.addEventListener("input", () => {
        state.profile.mobile = mobileInput.value;
      });

      document.getElementById("backToAccount")?.addEventListener("click", () => {
        state.step = "account";
        render();
      });

      profileForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const name = nameInput.value.trim();
        const mobile = normalizeMobile(mobileInput.value.trim());
        const digits = mobile.replace(/\D/g, "");
        const nameOk = name.length >= 2;
        const mobileOk = digits.length >= 10 && digits.length <= 15;

        document.getElementById("nameError").textContent = nameOk ? "" : "Enter at least 2 characters.";
        document.getElementById("mobileError").textContent = mobileOk
          ? ""
          : "Enter a valid 10 to 15 digit mobile number.";

        if (!nameOk || !mobileOk) return;

        state.profile.name = name;
        state.profile.mobile = mobile;
        state.step = "emailSent";
        render();
      });
    }

    document.getElementById("backToProfile")?.addEventListener("click", () => {
      state.step = "profile";
      render();
    });

    document.getElementById("openLoginLink")?.addEventListener("click", () => {
      state.step = "confirm";
      render();
    });

    document.getElementById("backToEmail")?.addEventListener("click", () => {
      state.step = "emailSent";
      render();
    });

    document.getElementById("enterWorkspace")?.addEventListener("click", async () => {
      state.step = "workspace";
      state.locked = false;
      await provisionApiKey();
      render();
    });

    document.getElementById("toggleKey")?.addEventListener("click", () => {
      state.keyVisible = !state.keyVisible;
      render();
    });

    document.getElementById("copyKey")?.addEventListener("click", () => {
      if (!state.apiKey) return;
      copyText(state.apiKey, "Real API key copied.");
    });

    document.getElementById("regenerateKey")?.addEventListener("click", async () => {
      state.apiKey = "";
      state.keyVisible = false;
      state.lastRequest = null;
      await provisionApiKey();
      render();
    });

    document.getElementById("copySnippet")?.addEventListener("click", () => {
      if (!state.apiKey) return;
      copyText(fullSnippet(state.apiKey), "Snippet copied with the real key.");
    });

    document.getElementById("lockNow")?.addEventListener("click", () => {
      state.locked = true;
      render();
    });

    document.getElementById("logout")?.addEventListener("click", () => {
      state.logoutOpen = true;
      render();
    });

    document.getElementById("unlock")?.addEventListener("click", () => {
      state.locked = false;
      render();
    });

    document.getElementById("lockedLogout")?.addEventListener("click", () => {
      state.logoutOpen = true;
      state.locked = false;
      render();
    });

    document.getElementById("cancelLogout")?.addEventListener("click", () => {
      state.logoutOpen = false;
      render();
    });

    document.getElementById("confirmLogout")?.addEventListener("click", () => {
      clearSensitiveState();
      showToast("Local session wiped.");
      render();
    });

    const modelSelect = document.getElementById("modelSelect");
    modelSelect?.addEventListener("change", () => {
      state.model = modelSelect.value;
    });

    document.querySelectorAll("[data-prompt]").forEach((button) => {
      button.addEventListener("click", () => {
        const input = document.getElementById("chatInput");
        input.value = button.dataset.prompt || "";
        input.focus();
      });
    });

    const chatForm = document.getElementById("chatForm");
    chatForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const input = document.getElementById("chatInput");
      const text = input.value.trim();
      if (!text || state.chatBusy || !state.apiKey) return;

      state.chatBusy = true;
      state.messages.push({ role: "user", text });
      state.lastRequest = buildRequestPreview();
      state.messages.push({ role: "assistant", text: "Sending through Create_AI_API...", pending: true });
      input.value = "";
      render();

      try {
        const reply = await callCreateAiApi();
        const pending = state.messages.find((message) => message.pending);
        if (pending) {
          pending.text = reply;
          pending.pending = false;
        }
        state.connection = "live";
      } catch (error) {
        const pending = state.messages.find((message) => message.pending);
        if (pending) {
          pending.text = createAssistantReply(text, error.message);
          pending.pending = false;
        }
        state.connection = state.apiKeySource === "server" ? "preview" : state.connection;
      }

      state.chatBusy = false;
      render();
    });
  }

  render();
})();
