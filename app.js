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

    if ("LanguageModel" in self) {
      session = await LanguageModel.create({
        systemPrompt: "You are SafeBug, a fast, privacy-first code debugger. Find bugs, security leaks, or syntax issues in the user's code and provide a clean, concise fix."
      });
    } else if (self.ai && self.ai.languageModel) {
      session = await self.ai.languageModel.create({
        systemPrompt: "You are SafeBug, a fast, privacy-first code debugger. Find bugs, security leaks, or syntax issues in the user's code and provide a clean, concise fix."
      });
    } else {
      throw new Error("Chrome LanguageModel API not found. Make sure you opened http://127.0.0.1:5500/index.html in the exact Chrome profile where your flags are enabled!");
    }

    const result = await session.prompt(`Debug this code:\n\n${code}`);
    
    renderOutput(result, "🔒 Local On-Device Debug (Gemini Nano)");
    session.destroy();
    //session.destroy();
  } catch (error) {
    outputBox.textContent = `❌ Error: ${error.message}`;
    console.error(error);
  } finally {
    debugBtn.disabled = false;
  }
});

const cloudDebugBtn = document.getElementById("cloudDebugBtn");
const smartDebugBtn = document.getElementById("smartDebugBtn");
const GEMINI_API_KEY = config.geminiApiKey;

function redactSecrets(sourceCode) {
  return sourceCode
    .replace(/(AIza[0-9A-Za-z\-_]{35})/g, "[REDACTED_API_KEY]")
    .replace(/(sk-[A-Za-z0-9\-_]{10,})/g, "[REDACTED_SECRET_KEY]")
    .replace(/(password\s*=\s*["'][^"']+["'])/gi, 'password = "[REDACTED]"');
}

if (cloudDebugBtn) {
  cloudDebugBtn.addEventListener("click", async () => {
    const rawCode = codeInput.value.trim();

    if (!rawCode) {
      outputBox.textContent = "⚠️ Please paste some code first!";
      return;
    }

    const sanitizedCode = redactSecrets(rawCode);
    outputBox.textContent = "🛡️ Redacting secrets locally & running Cloud Gemini deep audit...";
    cloudDebugBtn.disabled = true;
    debugBtn.disabled = true;

    try {
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
                    text: `You are SafeBug Cloud Auditor. Perform a deep bug, edge-case, and security review of this sanitized code:\n\n${sanitizedCode}`
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

      const redactedPreview = `🔒 Sanitized Code Sent to Cloud:\n${sanitizedCode}`;
      renderOutput(cloudReply, redactedPreview);
    } catch (error) {
      outputBox.textContent = `❌ Cloud Error: ${error.message}`;
      console.error(error);
    } finally {
      cloudDebugBtn.disabled = false;
      debugBtn.disabled = false;
    }
  });
}

async function hasLocalNano() {
  if ("LanguageModel" in self) return true;
  if (self.ai && self.ai.languageModel) return true;
  return false;
}

async function runCloudAudit(rawCode) {
  const sanitizedCode = redactSecrets(rawCode);
  outputBox.textContent = "🛡️ Escalating to Cloud AI (redacting secrets locally first)...";

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
                text: `You are SafeBug Cloud Auditor. Perform a deep bug, edge-case, and security review of this sanitized code:\n\n${sanitizedCode}`
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

  const redactedPreview = `⚡ Smart Route: Cloud Deep Audit\n🔒 Sanitized Code Sent to Cloud:\n${sanitizedCode}`;
  renderOutput(cloudReply, redactedPreview);
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
        let session = "LanguageModel" in self
          ? await LanguageModel.create({
              systemPrompt: "You are SafeBug, a fast, privacy-first code debugger. Find bugs, security leaks, or syntax issues in the user's code and provide a clean, concise fix."
            })
          : await self.ai.languageModel.create({
              systemPrompt: "You are SafeBug, a fast, privacy-first code debugger. Find bugs, security leaks, or syntax issues in the user's code and provide a clean, concise fix."
            });

        const result = await session.prompt(`Debug this code:\n\n${code}`);
        renderOutput(result, "⚡ Smart Route: Local Gemini Nano (On-Device)");
        session.destroy();
      } else {
        await runCloudAudit(code);
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