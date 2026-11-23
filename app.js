// Import Firebase SDK via CDN (works directly in the browser)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";

const config = window.SAFEBUG_CONFIG || {};
const firebaseConfig = config.firebase;

// Initialize Firebase
const app = initializeApp(firebaseConfig);
console.log("Firebase initialized:", app.name);

// Connect UI Elements
const codeInput = document.getElementById("codeInput");
const debugBtn = document.getElementById("debugBtn");
const outputBox = document.getElementById("outputBox");
const cloudDebugBtn = document.getElementById("cloudDebugBtn");
const smartDebugBtn = document.getElementById("smartDebugBtn");
const GEMINI_API_KEY = config.geminiApiKey;

// Local Gemini Nano Debugging Function
debugBtn.addEventListener("click", async () => {
  const code = codeInput.value.trim();

  if (!code) {
    outputBox.textContent = "⚠️ Please paste some code first!";
    return;
  }

  outputBox.textContent = "🔍 Analyzing code locally with Gemini Nano (100% private)...";
  debugBtn.disabled = true;

  try {
    let session;
    const systemPrompt =
      "You are SafeBug, a fast, privacy-first code debugger. Find bugs, security leaks, or syntax issues in the user's code and provide a clean, concise fix.";

    if ("LanguageModel" in self) {
      session = await LanguageModel.create({ systemPrompt, outputLanguage: "en" });
    } else if (self.ai && self.ai.languageModel) {
      session = await self.ai.languageModel.create({ systemPrompt, outputLanguage: "en" });
    } else {
      throw new Error(
        "Chrome LanguageModel API not found. Make sure you opened http://127.0.0.1:5500/index.html in the exact Chrome profile where your flags are enabled!"
      );
    }

    const result = await session.prompt(`Debug this code:\n\n${code}`);
    renderOutput(result, "🔒 Local On-Device Debug (Gemini Nano)");
    session.destroy();
  } catch (error) {
    outputBox.textContent = `❌ Error: ${error.message}`;
    console.error(error);
  } finally {
    debugBtn.disabled = false;
  }
});

function redactSecrets(sourceCode) {
  let sanitized = sourceCode;
  const detectedTypes = new Set();
  let totalRedactions = 0;

  const rules = [
    { label: "Google API Key", regex: /AIza[0-9A-Za-z\-_]{35}/g, replacement: "[REDACTED_GOOGLE_API_KEY]" },
    { label: "Secret Key", regex: /sk-[A-Za-z0-9\-_]{16,}/g, replacement: "[REDACTED_SECRET_KEY]" },
    { label: "GitHub Token", regex: /gh[pousr]_[A-Za-z0-9]{20,}/g, replacement: "[REDACTED_GITHUB_TOKEN]" },
    { label: "Database URI", regex: /(mongodb(\+srv)?|postgres(ql)?|mysql):\/\/[^\s"'`]+/gi, replacement: "$1://[REDACTED_DB]" },
    { label: "Hardcoded Secret", regex: /((?:password|passwd|secret|api_?key|token)\s*[:=]\s*["'`])[^"'`\n]+(["'`])/gi, replacement: "$1[REDACTED]$2" }
  ];

  for (const rule of rules) {
    sanitized = sanitized.replace(rule.regex, (...args) => {
      totalRedactions++;
      detectedTypes.add(rule.label);
      return rule.replacement.replace(/\$(\d)/g, (_, idx) => args[Number(idx)] ?? "");
    });
  }

  return { sanitized, count: totalRedactions, types: Array.from(detectedTypes) };
}

async function hasLocalNano() {
  return Boolean("LanguageModel" in self || (self.ai && self.ai.languageModel));
}

async function runCloudAudit(rawCode, routeLabel = "⚡ Smart Route: Cloud Deep Audit") {
  const { sanitized, count, types } = redactSecrets(rawCode);
  outputBox.textContent = `🛡️ Redacted ${count} secret(s) locally & sending sanitized code to Cloud AI...`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `You are SafeBug Cloud Auditor. Perform a deep bug, edge-case, and security review of this sanitized code:\n\n${sanitized}`
              }
            ]
          }
        ]
      })
    }
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || "Cloud Gemini request failed");
  }

  const cloudReply =
    data.candidates?.[0]?.content?.parts?.[0]?.text || "No response received from Cloud AI.";

  const secretSummary =
    count > 0 ? `🛡️ Redacted ${count} (${types.join(", ")})` : "🛡️ 0 secrets detected";

  const redactedPreview = `${routeLabel}\n${secretSummary}\n🔒 Sanitized Code Sent to Cloud:\n${sanitized}`;
  renderOutput(cloudReply, redactedPreview);
}

if (cloudDebugBtn) {
  cloudDebugBtn.addEventListener("click", async () => {
    const rawCode = codeInput.value.trim();

    if (!rawCode) {
      outputBox.textContent = "⚠️ Please paste some code first!";
      return;
    }

    cloudDebugBtn.disabled = true;
    debugBtn.disabled = true;
    if (smartDebugBtn) smartDebugBtn.disabled = true;

    try {
      await runCloudAudit(rawCode, "☁️ Deep Audit with Cloud AI");
    } catch (error) {
      outputBox.textContent = `❌ Cloud Error: ${error.message}`;
      console.error(error);
    } finally {
      cloudDebugBtn.disabled = false;
      debugBtn.disabled = false;
      if (smartDebugBtn) smartDebugBtn.disabled = false;
    }
  });
}

if (smartDebugBtn) {
  smartDebugBtn.addEventListener("click", async () => {
    const code = codeInput.value.trim();

    if (!code) {
      outputBox.textContent = "⚠️ Please paste some code first!";
      return;
    }

    smartDebugBtn.disabled = true;
    debugBtn.disabled = true;
    if (cloudDebugBtn) cloudDebugBtn.disabled = true;

    try {
      const nanoAvailable = await hasLocalNano();
      const isShortSnippet = code.length <= 600;

      if (nanoAvailable && isShortSnippet) {
        outputBox.textContent = "⚡ Smart Route: Local Gemini Nano (short snippet, 100% on-device)...";
        const systemPrompt =
          "You are SafeBug, a fast, privacy-first code debugger. Find bugs, security leaks, or syntax issues in the user's code and provide a clean, concise fix.";

        const session = "LanguageModel" in self
          ? await LanguageModel.create({ systemPrompt, outputLanguage: "en" })
          : await self.ai.languageModel.create({ systemPrompt, outputLanguage: "en" });

        const result = await session.prompt(`Debug this code:\n\n${code}`);
        renderOutput(result, "⚡ Smart Route: Local Gemini Nano (On-Device)");
        session.destroy();
      } else {
        await runCloudAudit(code, "⚡ Smart Route: Cloud Deep Audit");
      }
    } catch (error) {
      outputBox.textContent = `❌ Smart Hybrid Error: ${error.message}`;
      console.error(error);
    } finally {
      smartDebugBtn.disabled = false;
      debugBtn.disabled = false;
      if (cloudDebugBtn) cloudDebugBtn.disabled = false;
    }
  });
}

function renderOutput(markdownText, prefixHeader = "") {
  const safeMarkdown = typeof marked !== "undefined" ? marked.parse(markdownText) : markdownText;
  const safeHeader = prefixHeader
    ? `<pre style="white-space:pre-wrap;background:rgba(0,0,0,0.25);padding:10px;border-radius:8px;margin-bottom:12px;">${prefixHeader.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>`
    : "";
  outputBox.innerHTML = `${safeHeader}<div class="ai-markdown-body">${safeMarkdown}</div>`;
}