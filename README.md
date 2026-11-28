# 🛡️ SafeBug — Privacy-First Hybrid AI Code Debugger

**SafeBug** is a zero-backend, browser-native AI code debugger that protects developer credentials before a single byte leaves the machine. It combines **Chrome's built-in Gemini Nano** (`LanguageModel` API) for 100% on-device debugging with a **client-side secret redaction engine** and **Google Gemini Cloud API** for deep edge-case audits—backed by a sanitized **Firebase Firestore** audit log.

> 🎬 **Demo Video:** [Watch the 3-Minute Demo on YouTube](https://www.youtube.com/watch?v=68EtWh8mNyA)
> 💻 **GitHub Repository:** [vaishnavi-08-chadichal/safebug-hybrid-ai](https://github.com/vaishnavi-08-chadichal/safebug-hybrid-ai)

---

## ✨ Key Features

- **🔒 100% On-Device Local Debugging (Gemini Nano):** Uses Chrome's Prompt API (`LanguageModel`) to analyze code and generate fixes completely offline with zero network payload.
- **🛡️ Client-Side Secret Redaction Engine:** Scans code locally via regex before any cloud request or database write—automatically masking Google API keys (`AIza...`), Stripe/API secret keys (`sk-...`), GitHub tokens (`ghp_...`), database connection URIs (`mongodb+srv://...`, `postgres://...`), and hardcoded passwords.
- **⚡ Smart Hybrid Router & Resilience:** Dynamically routes between Local Gemini Nano and Cloud Gemini (`gemini-2.5-flash` with `gemini-3.5-flash-lite` fallback), featuring `15s` `AbortController` timeouts and automatic on-device fallback during cloud traffic spikes.
- **🕒 Sanitized Audit History (Firebase Firestore):** Logs recent debug sessions with redaction counts and sanitized previews—never storing raw secrets.
- **🧪 Built-in Vulnerable Sample & One-Click Copy:** Includes a one-click sample snippet with intentional security/logic bugs and exposed credentials for instant testing, plus one-click copy for generated fixes.

---

## 🏗️ Architecture

```text
[User Code Input]
       │
       ├──► [Debug with Local AI] ──► Chrome LanguageModel (Gemini Nano) ──► 100% On-Device Fix
       │
       ├──► [Deep Audit with Cloud AI] ──► Client-Side Regex Redactor ──► Sanitized Prompt ──► Gemini Cloud API
       │
       └──► [Smart Hybrid Debug] ──► Routes Local vs. Cloud + Automatic Fallback
                                              │
                                              ▼
                                 [Firebase Firestore Audit Log]
                                (Stores ONLY sanitized previews)