# 9Router AI Gateway — Team Setup & Daily Startup Guide

> **Purpose:** Setup guide for teammates to install and run **9Router** locally as a private AI gateway for Claude Code, Codex, and other LLM tools, including a silent daily background startup on Windows.

---

## 📌 Overview

**9Router** is a high-performance local proxy and AI gateway (`http://127.0.0.1:20128/v1`) that translates Anthropic `/v1/messages` and OpenAI `/v1/chat/completions` requests to various backend providers:
- **GitHub Models** (e.g. `gh/kimi-k3`, `gh/gpt-5.6-luna`)
- **Azure AI Foundry / Serverless** (e.g. `azure/DeepSeek-V4-Flash`, `azure/gpt-5.6-luna`)
- **OpenAI, DeepSeek Direct, Groq, Ollama, etc.**

By running 9Router locally, you get transparent model routing, high context limits (up to 1M tokens), and multi-provider failover without modifying your code.

```
┌────────────────────────────────────────────────────────┐
│             Claude Code / Codex / Apps                 │
│         (ANTHROPIC_BASE_URL=http://127.0.0.1:20128/v1) │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│                9Router Local Gateway                   │
│               Port 20128 (Local Daemon)                │
└──────────────┬──────────────────────────┬──────────────┘
               │                          │
               ▼                          ▼
    GitHub Models API          Azure AI Foundry / OpenAI
```

---

## 📋 Prerequisites

1. **Node.js**: v18+ or v20+ LTS installed ([nodejs.org](https://nodejs.org/))
2. **Git**: Installed and configured on your machine
3. **OS**: Windows 10/11 (PowerShell 5.1+ or PowerShell 7+)

---

## 🚀 Step 1: Clone & Install 9Router

1. Clone or copy the 9Router repository to your local workspace:
   ```bash
   # Example target directory: C:\repos\9router
   git clone https://github.com/RyotaKun/9router.git C:\repos\9router
   cd C:\repos\9router
   ```

2. Install dependencies:
   ```bash
   npm install
   ```
   > 💡 **Note on `better-sqlite3` warning:** If you see a warning about `better-sqlite3`, that is expected on Windows machines without C++ build tools. 9Router automatically uses native `node:sqlite` as a fallback.

---

## ⚙️ Step 2: Configure AI Providers & API Keys

1. Start 9Router temporarily to configure your connections:
   ```bash
   npm run dev -- --port 20128
   ```

2. Open the 9Router dashboard in your browser:
   👉 **`http://localhost:20128`**

3. Navigate to **Connections** / **Providers** in the dashboard:
   - Add your **GitHub Personal Access Token (PAT)** for GitHub Models.
   - Add your **Azure AI Foundry / Azure OpenAI** endpoints and API keys.
   - Set up your desired model aliases (e.g. `gh/kimi-k3`, `azure/DeepSeek-V4-Flash`).

4. Verify your virtual token:
   - Go to **API Keys** / **Settings** in the dashboard and note your 9Router virtual key (e.g. `sk-a9b4...`).

5. Press `Ctrl + C` in the terminal to stop the temporary server.

---

## 🔄 Step 3: Configure Automated Daily Silent Startup (Windows)

To run 9Router permanently in the background without needing to keep a terminal window open, set up the **3-file silent runner** and register it in Windows Startup.

### 1. Create `scripts/start-9router.bat`
In your `9router` folder, create `scripts\start-9router.bat`:
```cmd
@echo off
cd /d "%~dp0\.."
npx next dev --port 20128
```

### 2. Create `scripts/start-9router-silent.vbs`
In `scripts\start-9router-silent.vbs`:
```vbs
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c """ & CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName) & "\start-9router.bat""", 0, False
```

### 3. Create `scripts/stop-9router.bat`
In `scripts\stop-9router.bat` (helper to stop the daemon when needed):
```cmd
@echo off
powershell -Command "Get-NetTCPConnection -LocalPort 20128 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }; Write-Host '9Router stopped.'"
```

### 4. Register in Windows Startup (`shell:startup`)
Run this single PowerShell command (replace `C:\repos\9router` with your actual path if different):

```powershell
$9routerPath = "C:\repos\9router"
$WshShell = New-Object -ComObject WScript.Shell
$ShortcutPath = [System.IO.Path]::Combine($env:APPDATA, 'Microsoft\Windows\Start Menu\Programs\Startup\9Router.lnk')
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = 'wscript.exe'
$Shortcut.Arguments = "`"$9routerPath\scripts\start-9router-silent.vbs`""
$Shortcut.WorkingDirectory = $9routerPath
$Shortcut.Description = '9Router AI Router Background Daemon'
$Shortcut.Save()
Write-Host "✅ 9Router successfully registered for Windows Startup at: $ShortcutPath" -ForegroundColor Green
```

### 5. Launch 9Router in the background now:
```powershell
wscript "C:\repos\9router\scripts\start-9router-silent.vbs"
```

---

## 🔌 Step 4: Configure Claude Code to Use 9Router

### Option A: Local Workspace Configuration (Recommended)
In any project repository where you want Claude Code to use 9Router, create or update `.claude/settings.local.json`:

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://127.0.0.1:20128/v1",
    "ANTHROPIC_AUTH_TOKEN": "sk-a9b417d6786a6843-0vzifd-6d130fd7",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "gh/kimi-k3",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "azure/gpt-5.6-luna",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "azure/DeepSeek-V4-Flash",
    "ANTHROPIC_DEFAULT_FABLE_MODEL": "gh/kimi-k3",
    "CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY": "1",
    "API_TIMEOUT_MS": "900000",
    "CLAUDE_STREAM_IDLE_TIMEOUT_MS": "900000",
    "ANTHROPIC_EXTRA_HEADERS": "X-Execution-Env: local",
    "CLAUDE_CODE_MAX_CONTEXT_TOKENS": "998000"
  },
  "model": "gh/kimi-k3"
}
```

### Option B: User-Global Configuration
If you want 9Router to be your default across all projects, add the `env` block above to:
`%USERPROFILE%\.claude\settings.json`

---

## 🔀 Step 5: (Recommended) Setup the Provider Switcher Skill (`ryo-smart-provider-switcher`)

If your team frequently switches between **9Router** (local proxy), **Weir** (Upland LiteLLM Gateway), and **AWS Bedrock**, manually editing `settings.local.json` in every project can cause syntax errors or accidentally wipe project permissions.

The `ryo-smart-provider-switcher` skill automates this safely:
- 🛡️ **Zero Data Loss:** Automatically creates timestamped backups (`settings.local.json.bak.<timestamp>`) before modifying anything.
- 🧩 **Deep Merge:** Updates routing URLs and models while **preserving 100% of project permissions** (`permissions.allow`, `disabledMcpjsonServers`, custom API keys).
- 🧹 **Weir Auth Token Isolation:** Automatically strips `ANTHROPIC_AUTH_TOKEN` when switching to Weir so `apiKeyHelper` works properly without `401 Unauthorized` errors.

### 1. Store Base Provider Templates
Store your default templates in `~/.claude/.claude/`:

- **`~/.claude/.claude/settings.local.json.9router.bak`**:
  ```json
  {
    "env": {
      "ANTHROPIC_BASE_URL": "http://127.0.0.1:20128/v1",
      "ANTHROPIC_AUTH_TOKEN": "sk-a9b417d6786a6843-0vzifd-6d130fd7",
      "ANTHROPIC_DEFAULT_SONNET_MODEL": "gh/kimi-k3",
      "ANTHROPIC_DEFAULT_OPUS_MODEL": "azure/gpt-5.6-luna",
      "ANTHROPIC_DEFAULT_HAIKU_MODEL": "azure/DeepSeek-V4-Flash",
      "ANTHROPIC_DEFAULT_FABLE_MODEL": "gh/kimi-k3",
      "CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY": "1",
      "API_TIMEOUT_MS": "900000",
      "CLAUDE_STREAM_IDLE_TIMEOUT_MS": "900000",
      "ANTHROPIC_EXTRA_HEADERS": "X-Execution-Env: local",
      "CLAUDE_CODE_MAX_CONTEXT_TOKENS": "998000"
    },
    "model": "gh/kimi-k3"
  }
  ```

- **`~/.claude/.claude/settings.local.json.weir.bak`**:
  ```json
  {
    "apiKeyHelper": "\"C:\\Users\\sangm\\AppData\\Local\\Microsoft\\WindowsApps\\PythonSoftwareFoundation.Python.3.13_qbz5n2kfra8p0\\python.exe\" \"C:\\Users\\sangm\\.claude\\weir\\key-launcher.py\"",
    "env": {
      "AWS_PROFILE": "weir-struong",
      "AWS_REGION": "us-east-1",
      "CLAUDE_CODE_USE_BEDROCK": "0",
      "ANTHROPIC_BASE_URL": "https://weir.upland.one",
      "CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY": "1",
      "ANTHROPIC_DEFAULT_HAIKU_MODEL": "claude-haiku-4-5-20251001",
      "ANTHROPIC_DEFAULT_SONNET_MODEL": "claude-sonnet-4-6",
      "ANTHROPIC_DEFAULT_OPUS_MODEL": "claude-opus-5",
      "ANTHROPIC_DEFAULT_FABLE_MODEL": "claude-sonnet-4-6",
      "API_TIMEOUT_MS": "900000",
      "CLAUDE_STREAM_IDLE_TIMEOUT_MS": "900000",
      "ANTHROPIC_EXTRA_HEADERS": "X-Execution-Env: local",
      "CLAUDE_CODE_MAX_CONTEXT_TOKENS": "998000"
    },
    "model": "sonnet"
  }
  ```

### 2. How to Switch Providers in Any Folder
From your active terminal inside any project folder (e.g. `C:\repos\my-project`):

```bash
# Switch current project workspace to 9Router
python C:/Users/sangm/.claude/my-plugins/skills/ryo-smart-provider-switcher/scripts/switch_provider.py 9router

# Switch current project workspace to Weir
python C:/Users/sangm/.claude/my-plugins/skills/ryo-smart-provider-switcher/scripts/switch_provider.py weir

# Switch current project workspace to Bedrock
python C:/Users/sangm/.claude/my-plugins/skills/ryo-smart-provider-switcher/scripts/switch_provider.py bedrock

# Inspect active provider configuration for current directory
python C:/Users/sangm/.claude/my-plugins/skills/ryo-smart-provider-switcher/scripts/switch_provider.py status

# Preview changes before applying (dry-run)
python C:/Users/sangm/.claude/my-plugins/skills/ryo-smart-provider-switcher/scripts/switch_provider.py 9router --dry-run
```

---

## ✅ Step 6: Verification & Health Checks

### 1. Verify 9Router is Online & Serving Models
Run in PowerShell:
```powershell
curl.exe -s http://127.0.0.1:20128/v1/models
```
*(Expected: HTTP 200 with JSON list of configured models).*

### 2. Test Claude Code with 9Router
Run a quick single-turn prompt in your terminal:
```bash
claude -p "Say hi in one word" --model sonnet
```
*(Expected: Responds `Hi!` or `Hello!` routed directly through 9Router).*

---

## 🛠️ Troubleshooting & Maintenance

| Issue | Cause | Fix |
|---|---|---|
| **`Connection Refused` on port 20128** | 9Router background process is not running. | Run `wscript "C:\repos\9router\scripts\start-9router-silent.vbs"` |
| **Port Collision on 20128** | An orphaned node process is holding the port. | Run `C:\repos\9router\scripts\stop-9router.bat` then start again. |
| **Model 404 / Route Not Found** | Model name in `settings.local.json` doesn't match dashboard. | Check `http://localhost:20128` and ensure model alias matches (e.g. `gh/kimi-k3`). |
| **Weir 401 Unauthorized** | Environment variable `$env:ANTHROPIC_AUTH_TOKEN` is poisoning the request. | Run `$env:ANTHROPIC_AUTH_TOKEN = $null` in PowerShell and ensure `switch_provider.py weir` was run. |
| **Restarting 9Router** | After editing 9Router source code or config. | Run `stop-9router.bat` then launch `start-9router-silent.vbs`. |

---

## 📁 Summary of Files Created

```
C:\repos\9router\
├── scripts/
│   ├── start-9router.bat          # Core Next.js startup script
│   ├── start-9router-silent.vbs   # Silent invisible background wrapper
│   └── stop-9router.bat           # One-click process stopper
└── %APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\
    └── 9Router.lnk                # Auto-start on Windows boot
```

