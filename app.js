// Import Firebase SDK via CDN (works directly in the browser)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  query,
  limit,
  getDocs
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const config = window.SAFEBUG_CONFIG || {};
const firebaseConfig = config.firebase;

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const historyList = document.getElementById("historyList");
const privacyBadge = document.getElementById("privacyBadge");
const loadSampleBtn = document.getElementById("loadSampleBtn");
const copyOutputBtn = document.getElementById("copyOutputBtn");

let lastRawMarkdownOutput = "";

const SAMPLE_VULNERABLE_CODE = `// Sample Auth & Payment Handler (Contains Intentional Bugs + Exposed Secrets)
const GEMINI_KEY = "AIzaSyDemoFakeGoogleApiKey123456789012345";
const STRIPE_SECRET = "sk-live-9876543210abcdef123456";
const DB_URI = "mongodb+srv://admin:SuperSecretPass99@cluster0.example.invalid/prod";
const adminPassword = "admin123_hardcoded_password";

async function loginUser(req, dbClient) {
  const { username, password } = req.body;
  // Bug 1: SQL Injection vulnerability via string interpolation
  const query = "SELECT * FROM users WHERE username = '" + username + "' AND password = '" + password + "'";
  const user = await dbClient.query(query);

  // Bug 2: Assignment (=) instead of comparison (===) grants admin to everyone!
  if (user.role = "admin") {
    return { access: true, token: STRIPE_SECRET };
  }
  return { access: false };
}`;

function updatePrivacyBadge(text, mode = "ready") {
  if (!privacyBadge) return;
  privacyBadge.textContent = text;

  if (mode === "local") {
    privacyBadge.style.background = "rgba(16, 185, 129, 0.18)";
    privacyBadge.style.borderColor = "#10b981";
    privacyBadge.style.color = "#a7f3d0";
  } else if (mode === "cloud") {
    privacyBadge.style.background = "rgba(59, 130, 246, 0.18)";
    privacyBadge.style.borderColor = "#3b82f6";
    privacyBadge.style.color = "#bfdbfe";
  } else {
    privacyBadge.style.background = "rgba(16, 185, 129, 0.15)";
    privacyBadge.style.borderColor = "#10b981";
    privacyBadge.style.color = "#a7f3d0";
  }
}

async function loadDebugHistory() {
  if (!historyList) return;
  try {
    const q = query(collection(db, "debugHistory"), limit(5));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      historyList.textContent = "No debug runs saved yet.";
      return;
    }

    const docs = snapshot.docs
      .map((doc) => doc.data())
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    historyList.innerHTML = docs
      .map((item) => {
        const secretsLabel =
          item.redactionCount > 0
            ? `🛡️ ${item.redactionCount} secret(s) redacted`
            : "🛡️ 0 secrets";
        const safePreview = String(item.codePreview || "")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");

        return `
          <div style="border:1px solid #333;border-radius:8px;padding:10px;margin-bottom:8px;background:rgba(0,0,0,0.2);">
            <strong>${item.route || "Debug Run"}</strong> — <span>${secretsLabel}</span>
            <pre style="white-space:pre-wrap;margin-top:6px;font-size:12px;">${safePreview}</pre>
          </div>
        `;
      })
      .join("");
  } catch (err) {
    historyList.textContent = "Could not load history right now.";
    console.warn("History load failed:", err.message);
  }
}

loadDebugHistory();

async function saveDebugSession({ route, rawCode, sanitizedCode, redactionCount = 0, secretTypes = [] }) {
  try {
    const safeCodeToStore = sanitizedCode ?? redactSecrets(rawCode).sanitized;
    await addDoc(collection(db, "debugHistory"), {
      route,
      codePreview: safeCodeToStore.slice(0, 300),
      redactionCount,
      secretTypes,
      createdAt: serverTimestamp()
    });
    await loadDebugHistory();
    console.log("Saved debug session to Firestore:", route);
  } catch (err) {
    console.warn("Firestore save skipped/failed:", err.message);
  }
}
console.log("Firebase initialized:", app.name);

// Connect UI Elements
const codeInput = document.getElementById("codeInput");
const debugBtn = document.getElementById("debugBtn");
const outputBox = document.getElementById("outputBox");
const cloudDebugBtn = document.getElementById("cloudDebugBtn");
const smartDebugBtn = document.getElementById("smartDebugBtn");
const GEMINI_API_KEY = config.geminiApiKey;

if (loadSampleBtn) {
  loadSampleBtn.addEventListener("click", () => {
    codeInput.value = SAMPLE_VULNERABLE_CODE;
    updatePrivacyBadge("🧪 Sample loaded (4 fake secrets + 2 bugs ready to test)", "ready");
  });
}

if (copyOutputBtn) {
  copyOutputBtn.addEventListener("click", async () => {
    const textToCopy = lastRawMarkdownOutput || outputBox.innerText;
    if (!textToCopy || textToCopy === "AI response will appear here...") return;

    try {
      await navigator.clipboard.writeText(textToCopy);
      const originalText = copyOutputBtn.textContent;
      copyOutputBtn.textContent = "✅ Copied!";
      setTimeout(() => {
        copyOutputBtn.textContent = originalText;
      }, 1800);
    } catch (err) {
      console.warn("Clipboard copy failed:", err.message);
    }
  });
}

// Local Gemini Nano Debugging Function
debugBtn.addEventListener("click", async () => {
  const code = codeInput.value.trim();

  if (!code) {
    outputBox.textContent = "⚠️ Please paste some code first!";
    return;
  }

  outputBox.textContent = "🔍 Analyzing code locally with Gemini Nano (100% private)...";
  updatePrivacyBadge("🔒 Running 100% On-Device (Gemini Nano)...", "local");
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
    updatePrivacyBadge("🔒 100% On-Device (Gemini Nano) — Zero Network Payload", "local");
    session.destroy();

    const { sanitized, count, types } = redactSecrets(code);
    await saveDebugSession({
      route: "Local Gemini Nano",
      rawCode: code,
      sanitizedCode: sanitized,
      redactionCount: count,
      secretTypes: types
    });
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

async function fetchGeminiWithTimeout(modelName, promptText, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }]
        }),
        signal: controller.signal
      }
    );

    const json = await response.json();
    if (!response.ok) {
      throw new Error(json.error?.message || `HTTP ${response.status}`);
    }
    return json;
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(`${modelName} timed out after ${timeoutMs / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function runCloudAudit(rawCode, routeLabel = "⚡ Smart Route: Cloud Deep Audit") {
  const { sanitized, count, types } = redactSecrets(rawCode);
  const promptText = `You are SafeBug Cloud Auditor. Perform a deep bug, edge-case, and security review of this sanitized code:\n\n${sanitized}`;
  const candidateModels = ["gemini-2.5-flash", "gemini-3.5-flash-lite"];

  let data = null;
  let lastErrorMessage = "Cloud Gemini request failed";

  for (const modelName of candidateModels) {
    outputBox.textContent = `🛡️ Redacted ${count} secret(s) locally • Asking ${modelName}...`;
    try {
      data = await fetchGeminiWithTimeout(modelName, promptText, 15000);
      break;
    } catch (err) {
      lastErrorMessage = err.message;
      console.warn(`Model ${modelName} skipped:`, err.message);
    }
  }

  if (!data) {
    throw new Error(
      `${lastErrorMessage} (Tip: Local Gemini Nano / Smart Hybrid still works on-device, or retry Cloud AI in a moment.)`
    );
  }

  const cloudReply =
    data.candidates?.[0]?.content?.parts?.[0]?.text || "No response received from Cloud AI.";

  const secretSummary =
    count > 0 ? `🛡️ Redacted ${count} (${types.join(", ")})` : "🛡️ 0 secrets detected";

  const redactedPreview = `${routeLabel}\n${secretSummary}\n🔒 Sanitized Code Sent to Cloud:\n${sanitized}`;
  renderOutput(cloudReply, redactedPreview);
  updatePrivacyBadge(
    `🛡️ Cloud Route — ${count} Secret(s) Redacted Locally Before Transit`,
    "cloud"
  );

  await saveDebugSession({
    route: routeLabel,
    rawCode,
    sanitizedCode: sanitized,
    redactionCount: count,
    secretTypes: types
  });
}

if (cloudDebugBtn) {
  cloudDebugBtn.addEventListener("click", async () => {
    const rawCode = codeInput.value.trim();

    if (!rawCode) {
      outputBox.textContent = "⚠️ Please paste some code first!";
      return;
    }

    outputBox.textContent = "🛡️ Redacting secrets locally & connecting to Cloud AI...";
    updatePrivacyBadge("🛡️ Sanitization & Cloud Route in progress...", "cloud");
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

    outputBox.textContent = "⚡ Evaluating Smart Route (Local Gemini Nano vs. Cloud)...";
    updatePrivacyBadge("⚡ Smart Hybrid Routing in progress...", "ready");
    smartDebugBtn.disabled = true;
    debugBtn.disabled = true;
    if (cloudDebugBtn) cloudDebugBtn.disabled = true;

    try {
      const nanoAvailable = await hasLocalNano();
      const isShortSnippet = code.length <= 600;

      if (nanoAvailable && isShortSnippet) {
        try {
          outputBox.textContent = "⚡ Smart Route: Local Gemini Nano (short snippet, 100% on-device)...";
          const systemPrompt =
            "You are SafeBug, a fast, privacy-first code debugger. Find bugs, security leaks, or syntax issues in the user's code and provide a clean, concise fix.";

          const session = "LanguageModel" in self
            ? await LanguageModel.create({ systemPrompt, outputLanguage: "en" })
            : await self.ai.languageModel.create({ systemPrompt, outputLanguage: "en" });

          const result = await session.prompt(`Debug this code:\n\n${code}`);
          renderOutput(result, "⚡ Smart Route: Local Gemini Nano (On-Device)");
          updatePrivacyBadge("🔒 100% On-Device (Smart Route) — Zero Network Payload", "local");
          session.destroy();

          const { sanitized, count, types } = redactSecrets(code);
          await saveDebugSession({
            route: "Smart Route: Local Gemini Nano",
            rawCode: code,
            sanitizedCode: sanitized,
            redactionCount: count,
            secretTypes: types
          });
        } catch (localErr) {
          console.warn("Local Nano unavailable, falling back to Cloud AI:", localErr.message);
          await runCloudAudit(code, "⚡ Smart Route: Cloud Fallback (Secrets Redacted)");
        }
      } else {
        try {
          await runCloudAudit(code, "⚡ Smart Route: Cloud Deep Audit");
        } catch (cloudErr) {
          if (nanoAvailable) {
            console.warn("Cloud AI busy, falling back to Local Nano:", cloudErr.message);
            outputBox.textContent = "⚡ Cloud busy — falling back to Local Gemini Nano (100% on-device)...";
            const systemPrompt =
              "You are SafeBug, a fast, privacy-first code debugger. Find bugs, security leaks, or syntax issues in the user's code and provide a clean, concise fix.";

            const session = "LanguageModel" in self
              ? await LanguageModel.create({ systemPrompt, outputLanguage: "en" })
              : await self.ai.languageModel.create({ systemPrompt, outputLanguage: "en" });

            const result = await session.prompt(`Debug this code:\n\n${code}`);
            renderOutput(result, "⚡ Smart Route: Local Nano Fallback (Cloud Busy)");
            updatePrivacyBadge("🔒 100% On-Device (Smart Fallback) — Zero Network Payload", "local");
            session.destroy();

            const { sanitized, count, types } = redactSecrets(code);
            await saveDebugSession({
              route: "Smart Route: Local Nano Fallback",
              rawCode: code,
              sanitizedCode: sanitized,
              redactionCount: count,
              secretTypes: types
            });
          } else {
            throw cloudErr;
          }
        }
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
  lastRawMarkdownOutput = markdownText;
  const safeMarkdown = typeof marked !== "undefined" ? marked.parse(markdownText) : markdownText;
  const safeHeader = prefixHeader
    ? `<pre style="white-space:pre-wrap;background:rgba(0,0,0,0.25);padding:10px;border-radius:8px;margin-bottom:12px;">${prefixHeader.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>`
    : "";
  outputBox.innerHTML = `${safeHeader}<div class="ai-markdown-body">${safeMarkdown}</div>`;
}