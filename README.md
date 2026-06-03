# Meepo Studio MCP Server

[![smithery badge](https://smithery.ai/badge/lastblezebub/meepo)](https://smithery.ai/servers/lastblezebub/meepo)

> Connect your AI agent to Meepo Studio. Create designs, manage campaigns, and generate videos — all without opening the browser.

**MCP (Model Context Protocol)** is the universal standard for AI agent tool access. This server works with **Claude Code**, **Claude Cowork**, **Gemini CLI**, **Cursor**, **Windsurf**, **Manus**, and any MCP-compatible AI agent.

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 20+** installed
- A **Meepo Studio account** (sign up at [app.meepo.studio](https://app.meepo.studio))
- An active **subscription with credits**

### Installation

```bash
# Clone the repo (if you don't have it)
git clone https://github.com/QTN-DEV/meepo.git
cd meepo/meepo-mcp-server

# Install dependencies
npm install
```

---

## 🔌 Setup by AI Agent

### Claude Code

Add to your Claude Code MCP config (`~/.claude/mcp.json`):

```json
{
  "mcpServers": {
    "meepo": {
      "command": "npx",
      "args": ["tsx", "/path/to/meepo/meepo-mcp-server/src/index.ts"],
      "env": {
        "MEEPO_EMAIL": "your@email.com",
        "MEEPO_PASSWORD": "your-password",
        "AUTH_SERVICE_URL": "https://auth.meepo.app",
        "DESIGN_SERVICE_URL": "https://api.meepo.app",
        "SUBSCRIPTION_SERVICE_URL": "https://sub.meepo.app",
        "VIDEO_SERVICE_URL": "https://video.meepo.app"
      }
    }
  }
}
```

### Gemini CLI

```json
{
  "mcpServers": {
    "meepo": {
      "command": "npx",
      "args": ["tsx", "/path/to/meepo/meepo-mcp-server/src/index.ts"],
      "env": {
        "MEEPO_EMAIL": "your@email.com",
        "MEEPO_PASSWORD": "your-password",
        "AUTH_SERVICE_URL": "https://auth.meepo.app",
        "DESIGN_SERVICE_URL": "https://api.meepo.app",
        "SUBSCRIPTION_SERVICE_URL": "https://sub.meepo.app",
        "VIDEO_SERVICE_URL": "https://video.meepo.app"
      }
    }
  }
}
```

### Cursor / Windsurf

Go to **Settings → MCP Servers → Add Server** and configure:

| Field | Value |
|-------|-------|
| Command | `npx` |
| Args | `tsx /path/to/meepo/meepo-mcp-server/src/index.ts` |
| MEEPO_EMAIL | `your@email.com` |
| MEEPO_PASSWORD | `your-password` |

### Local Development

For local development, set environment variables pointing to your local services:

```bash
export MEEPO_EMAIL="your@email.com"
export MEEPO_PASSWORD="your-password"
export AUTH_SERVICE_URL="http://localhost:8001"
export DESIGN_SERVICE_URL="http://localhost:8002"
export SUBSCRIPTION_SERVICE_URL="http://localhost:8003"
export VIDEO_SERVICE_URL="http://localhost:8006"

npx tsx src/index.ts
```

---

## 🛠 Available Tools

### Brand Management

| Tool | Description |
|------|-------------|
| `brand_list` | List all brands in your workspace |
| `brand_get` | Get brand details — colors, fonts, logo, guidelines |
| `brand_update` | Update brand settings |

### Campaign Management

| Tool | Description |
|------|-------------|
| `campaign_list` | List campaigns for a brand |
| `campaign_get` | Get campaign details + deliverables |
| `campaign_create` | Create a new campaign |
| `campaign_update` | Update campaign name/objective |
| `campaign_delete` | Delete a campaign |

### Design Requests (Chats)

| Tool | Description |
|------|-------------|
| `chat_list` | List all design requests |
| `chat_get` | Get a design request with messages + images |
| `chat_create` | **Create a new design request** — triggers AI generation |
| `chat_update` | Update title or move to folder |
| `chat_delete` | Delete a design request |

### Messages & Interactions

| Tool | Description |
|------|-------------|
| `message_list` | Get all messages in a chat |
| `message_send` | **Send follow-up** — edit requests, feedback |
| `message_generate_caption` | Generate social media caption |
| `message_generate_variant` | Generate design variant |

### Generated Images

| Tool | Description |
|------|-------------|
| `generation_list` | List all generated images for a chat |

### Templates

| Tool | Description |
|------|-------------|
| `template_list` | Browse available design templates |
| `template_get` | Get template details |

### Video

| Tool | Description |
|------|-------------|
| `video_list_projects` | List video projects |
| `video_create_project` | Create a new video project |
| `video_generate` | Trigger video generation |

### Credits & Subscription

| Tool | Description |
|------|-------------|
| `credits_check` | **Check your credit balance** |
| `subscription_status` | View subscription details |

---

## 💡 Example Conversations

### Create a Design

> **You:** "Create an Instagram carousel for my brand's summer sale. Use a 1:1 ratio, 6 slides."
>
> **Agent:** *Calls `brand_list` → `chat_create` with carousel params → Returns chat ID*
>
> **You:** "Make the background darker and add more contrast to the text"
>
> **Agent:** *Calls `message_send` with edit instruction → AI regenerates*

### Check Credits

> **You:** "How many design credits do I have left?"
>
> **Agent:** *Calls `credits_check` → "You have 45.2 credits remaining out of 100"*

### Campaign Workflow

> **You:** "Create a new campaign called 'Ramadan 2026' for Brand X, then generate 3 social media posts"
>
> **Agent:** *Calls `campaign_create` → `chat_create` (×3) → Returns generated designs*

---

## 🔒 Authentication & Credits

### How Auth Works

1. Your **email + password** are passed as environment variables
2. The MCP server authenticates via Meepo's auth API on first tool call
3. Session is cached — no repeated logins
4. Every tool that **generates** content checks your credit balance first
5. If credits are insufficient, the tool returns a clear error message with a link to upgrade

### Credit-Consuming Actions

| Action | Approximate Credits |
|--------|-------------------|
| Generate single image | ~1 credit |
| Generate carousel (6 slides) | ~6 credits |
| Generate caption | ~0.5 credits |
| Generate design variant | ~1 credit |
| Generate video | ~5 credits |

> **Note:** Actual credit usage varies based on model used and output complexity. Check `credits_check` for your exact balance.

---

## 🐳 Self-Hosting (Docker)

```bash
docker build -t meepo-mcp-server .
docker run -e MEEPO_EMAIL=you@email.com \
           -e MEEPO_PASSWORD=yourpass \
           -e AUTH_SERVICE_URL=https://auth.meepo.app \
           -e DESIGN_SERVICE_URL=https://api.meepo.app \
           -e SUBSCRIPTION_SERVICE_URL=https://sub.meepo.app \
           -e VIDEO_SERVICE_URL=https://video.meepo.app \
           meepo-mcp-server
```

---

## 🧪 Development & Testing

### Run the MCP Inspector

```bash
npx @modelcontextprotocol/inspector npx tsx src/index.ts
```

This opens a visual tool to test each MCP tool individually.

### Run Locally

```bash
npm run dev
```

---

## 📄 License

Proprietary — © Meepo Studio / QTN Dev
