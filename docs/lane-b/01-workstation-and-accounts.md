# docs/lane-b/01-workstation-and-accounts.md — Workstation Setup & Account Guide

This guide walks you through setting up your local Windows machine and obtaining the cloud accounts required for Lane B.

---

## 1. Local Machine Requirements

We assume you are developing on **Windows 11 or Windows 10** using **PowerShell**:

### Toolchain Versions
- **Node.js:** Pinned to `22.18.0` (check with `node -v`).
- **pnpm:** Pinned to `11.9.0` (check with `pnpm -v`).
- **Git:** Installed and available in PowerShell (`git --version`).
- **Docker:** **NOT required on your machine!** Local Bifrost runs via `pnpm dlx`, and Railway runs Bifrost in the cloud.

### Verifying Your Toolchain
Open PowerShell, navigate to the repository root (`C:\Users\Mayur\Desktop\Afterfact`), and run:
```powershell
node -v
pnpm -v
git status
```
Expected output:
- Node version: `v22.18.0`
- pnpm version: `11.9.0`
- Clean git status on your active branch.

---

## 2. Directory & Command Discipline in PowerShell

### Where to Run Commands
Every command in this handbook should be run from the **workspace root directory**:
`C:\Users\Mayur\Desktop\Afterfact`

If you are unsure where you are in PowerShell, run:
```powershell
pwd
```

### Commands That Exit vs. Commands That Stay Running
- **Commands that exit:** Build tools, tests, and migration scripts run, print output, and exit back to your PowerShell prompt (e.g. `pnpm build`, `pnpm test`, `pnpm prisma migrate dev`).
- **Commands that stay running (Daemons):** Development servers and gateways do **not** exit. They stay running to listen for network traffic:
  - `pnpm dev`: Runs Next.js on `http://localhost:3000`. Keep this PowerShell window open!
  - `pnpm bifrost`: Runs Bifrost gateway on `http://127.0.0.1:8080`. Keep a separate PowerShell window open for this!

---

## 3. Cloud Accounts & External Services Matrix

| Service | Purpose | Needed Now for Local Dev? | Needed for Staging / Prod? | How to Obtain / Configure |
| :--- | :--- | :---: | :---: | :--- |
| **Neon** | PostgreSQL database with instant branching | **Yes** (Dev branch) | **Yes** (Staging & Prod) | Sign up at [neon.tech](https://neon.tech), create project `afterfact`. |
| **Bifrost (Local)** | Local LLM gateway | **Yes** (`pnpm bifrost`) | No (Railway used) | Runs automatically via `pnpm bifrost` script without account. |
| **Railway** | Hosts Bifrost container in cloud | No (Use local script) | **Yes** (Phase 3 Staging) | Sign up at [railway.app](https://railway.app), deploy `maximhq/bifrost`. |
| **Tavily** | Live web search & excerpt extraction | Optional (Mocks work early) | **Yes** (Phase 1 Live slice) | Sign up at [tavily.com](https://tavily.com) to get API key (`tvly-...`). |
| **Upstash QStash**| Asynchronous job queue | Optional (In-process fallback)| **Yes** (Phase 2 Concurrency) | Sign up at [upstash.com](https://upstash.com), create QStash topic. |
| **Vercel** | Next.js serverless application hosting | No (Use `localhost:3000`) | **Yes** (Phase 3 Staging) | Sign up at [vercel.com](https://vercel.com), connect GitHub repository. |
| **Model Providers**| OpenAI, Anthropic, or Groq API keys | **Yes** (At least one key) | **Yes** | Obtain API key from provider; add to `.env` or Bifrost vault. |

---

## 4. Local Secrets vs. Hosted Secrets

### Where Local Secrets Live
Create a file named `.env.local` in the project root by copying from `.env.example`:
```powershell
Copy-Item .env.example .env.local
```
- `.env.local` is listed in `.gitignore`. It is **never** committed to git.
- When running locally, Next.js automatically loads `.env.local`.

### Where Hosted Secrets Live
- **On Vercel:** Go to `Project Settings -> Environment Variables`. Add `DATABASE_URL`, `DIRECT_URL`, `BIFROST_BASE_URL`, `BIFROST_GATEWAY_TOKEN`, `TAVILY_API_KEY`, `QSTASH_TOKEN`, etc.
- **On Railway:** Go to your Bifrost service `Variables` tab. Add `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GROQ_API_KEY`, `BIFROST_SETUP_TOKEN`, `PORT=8080`, `DATA_DIR=/app/data`.

> [!CRITICAL]
> **Secret Safety Rule (P28):**
> 1. Never commit `.env` or `.env.local` files to Git.
> 2. Never prefix secret API keys with `NEXT_PUBLIC_`. Any environment variable starting with `NEXT_PUBLIC_` is bundled into client-side JavaScript sent to the browser!
> 3. Database passwords and LLM keys belong strictly on the server side.
