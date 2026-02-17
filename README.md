# 🏪 Agent Marketplace

**Autonomous AI agents for OpenClaw.** Not just skills — full agents that plan, execute, and deliver complex workflows.

> **Skills do one thing. Agents do everything.**

```
You: "Launch my SaaS on Product Hunt next Tuesday"

Marketing Agent:
  ✅ Researched 15 competitor launches
  ✅ Wrote PH tagline, description, first comment
  ✅ Created blog post (SEO-optimized)
  ✅ Generated social posts for Twitter, LinkedIn, Instagram
  ✅ Scheduled everything for launch day
  ✅ Campaign complete — 8 steps, 3 minutes
```

## 🚀 Quick Start (OpenClaw Users)

### 1. Install the agent skill
```bash
clawhub install nextbase/marketing-agent
```

### 2. Configure your API keys
Add to your OpenClaw `.env`:
```env
# Required — LLM provider
LLM_API_KEY=your-openrouter-or-anthropic-key

# Optional — enables real web research
SEARCH_API_KEY=your-brave-search-key
SEARCH_PROVIDER=brave
```

### 3. Use it
Just talk to your OpenClaw bot:
```
"Write a blog post about AI trends in 2026"
"Launch my product on Product Hunt"
"Create a content marketing campaign for my startup"
"Research competitors in the project management space"
```

OpenClaw automatically routes your request to the right agent. That's it.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│              OpenClaw (user's bot)            │
│                                              │
│  User: "Write a blog about AI"               │
│       │                                      │
│       ▼                                      │
│  Skill: nextbase/marketing-agent             │
│       │                                      │
│       │  POST /api/v1/run                    │
│       ▼                                      │
│  ┌──────────────────────────────────────┐   │
│  │         Agent Marketplace API         │   │
│  │                                       │   │
│  │  Orchestrator                         │   │
│  │    ├── Researcher (real web search)   │   │
│  │    ├── Writer (SEO-optimized)         │   │
│  │    ├── Editor (quality + SEO review)  │   │
│  │    ├── Social Writer (all platforms)  │   │
│  │    ├── Publisher (WordPress, etc.)    │   │
│  │    ├── Brand Manager (voice check)    │   │
│  │    ├── Campaign Manager (multi-step)  │   │
│  │    ├── Scheduler (recurring)          │   │
│  │    └── Analytics (tracking)           │   │
│  └──────────────────────────────────────┘   │
│       │                                      │
│       ▼                                      │
│  Result shown to user in chat                │
└──────────────────────────────────────────────┘
```

## 📦 Available Agents

| Agent | Status | Description |
|---|---|---|
| 🎯 Marketing Agent | ✅ Live | Campaigns, content, social media, SEO writing |
| 📈 SEO Agent | 📋 Coming | Site audits, keyword research, rank tracking |
| 📧 Email Marketing | 📋 Coming | Sequences, newsletters, drip campaigns |
| 📝 Content Repurposer | 📋 Coming | One content → 10 formats |
| 📱 Social Media Manager | 📋 Coming | Content calendar, scheduling, engagement |
| 🤝 Sales Agent | 📋 Coming | Lead gen, outreach, follow-ups |
| 🛒 E-commerce Agent | 📋 Coming | Product listings, pricing analysis |

See [AGENT_CATALOG.md](AGENT_CATALOG.md) for the full roadmap (15 agents planned).

---

## 🔧 Self-Hosting (Run Your Own)

### Prerequisites
- [Bun](https://bun.sh) runtime
- LLM API key (OpenRouter, Anthropic, OpenAI, or Gemini)
- Optional: Brave Search API key (for real web research)

### Setup

```bash
# Clone
git clone https://github.com/nirav-kakadiya/agent_marketplace.git
cd agent_marketplace

# Install dependencies
bun install

# Configure
cp .env.example .env
# Edit .env with your API keys

# Run CLI
bun run index.ts "Write a blog about AI trends"

# Run API server
bun run server.ts
```

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `LLM_API_KEY` | ✅ | Your LLM provider API key |
| `LLM_PROVIDER` | ❌ | `openrouter` / `anthropic` / `openai` / `gemini` (default: `openrouter`) |
| `LLM_MODEL` | ❌ | Model to use (default: `anthropic/claude-sonnet-4`) |
| `SEARCH_API_KEY` | ❌ | Brave/Serper/Google search API key |
| `SEARCH_PROVIDER` | ❌ | `brave` / `serper` / `google` (default: `brave`) |
| `PORT` | ❌ | Server port (default: `3000`) |
| `AUTH_ENABLED` | ❌ | Enable API auth (default: `false`) |
| `BILLING_MODEL` | ❌ | `free` / `saas` / `hybrid` (default: `hybrid`) |

### CLI Usage

```bash
# Generate content
bun run index.ts "Write a blog about AI trends in 2026"

# Run a campaign
bun run index.ts "Launch my SaaS on Product Hunt"

# List agents
bun run index.ts --agents

# List campaign strategies
bun run index.ts --strategies

# List campaigns
bun run index.ts --campaigns

# Show config
bun run index.ts --config
```

### API Endpoints

```
# Main endpoint (OpenClaw calls this)
POST   /api/v1/run              { request: "your task" }

# Campaigns
POST   /api/v1/campaigns        Create campaign
GET    /api/v1/campaigns        List campaigns
GET    /api/v1/campaigns/:id    Campaign status
POST   /api/v1/campaigns/:id/run    Run campaign
POST   /api/v1/campaigns/:id/pause  Pause campaign

# Quick actions
POST   /api/v1/generate         One-shot generation
POST   /api/v1/research         Research a topic
POST   /api/v1/seo/keywords     Keyword research
POST   /api/v1/seo/serp         SERP analysis

# Info
GET    /api/v1/health           Health check
GET    /api/v1/config           Current config
GET    /api/v1/agents           List agents
GET    /api/v1/strategies       Campaign strategies
```

---

## ⚙️ Configuration

Everything is controlled by `config.json` — one file, zero code changes:

```json
{
  "billing": "hybrid",
  "execution": "both",
  "features": {
    "campaigns": true,
    "seoTools": true,
    "socialWriter": true,
    "publishing": true,
    "analytics": true,
    "scheduling": true,
    "brandManager": true
  },
  "limits": {
    "maxCampaignsPerMonth": -1,
    "maxGenerationsPerDay": -1,
    "maxTokensPerMonth": -1
  }
}
```

### Billing Models

| Model | User's Keys | Your Keys | Best For |
|---|---|---|---|
| `"free"` | ✅ Required | ❌ Ignored | Open source / community |
| `"hybrid"` | ✅ Preferred | ✅ Fallback | Freemium model |
| `"saas"` | ❌ Ignored | ✅ Always | Paid SaaS product |

Switch anytime — just change `"billing"` in config.json.

### Feature Flags

Toggle any feature on/off:
```json
"features": {
  "campaigns": false    ← Disables campaign manager
}
```

---

## 🧩 Project Structure

```
agent_marketplace/
├── config.json                    ← ONE config file controls everything
├── .env.example                   ← API key template
│
├── core/                          ← Foundation (rarely changes)
│   ├── config.ts                  ← Config loader + key resolver
│   ├── agent.ts                   ← BaseAgent interface
│   ├── message.ts                 ← Message types
│   ├── bus.ts                     ← Message bus (agent routing)
│   ├── llm.ts                     ← LLM providers (OpenRouter/Anthropic/OpenAI/Gemini)
│   ├── memory.ts                  ← Persistent memory
│   ├── tenant.ts                  ← Multi-tenant support
│   ├── auth.ts                    ← API key auth
│   └── executor.ts                ← Safe code execution
│
├── agents/                        ← Each agent = one folder
│   ├── orchestrator/              ← Routes tasks to right agent
│   ├── researcher/                ← Real web search + scraping
│   │   └── tools/
│   │       ├── web-search.ts      ← Brave/Serper/Google
│   │       ├── web-scraper.ts     ← Page content extraction
│   │       ├── competitor.ts      ← Competitor analysis
│   │       └── trend-finder.ts    ← Trend discovery
│   ├── writer/                    ← SEO-optimized content
│   │   └── tools/
│   │       ├── keyword-analyzer.ts
│   │       ├── outline-builder.ts
│   │       └── serp-analyzer.ts
│   ├── editor/                    ← Quality + SEO review
│   ├── social-writer/             ← Platform-specific posts
│   ├── publisher/                 ← Publish to platforms
│   ├── brand-manager/             ← Brand voice consistency
│   ├── campaign-manager/          ← Multi-step campaigns
│   │   ├── types.ts
│   │   └── strategies/
│   │       ├── product-launch.ts
│   │       ├── content-marketing.ts
│   │       └── social-blitz.ts
│   ├── scheduler/                 ← Recurring jobs
│   └── analytics/                 ← Performance tracking
│
├── integrations/                  ← Platform connectors (JSON configs)
│   ├── wordpress.json
│   ├── twitter.json
│   ├── linkedin.json
│   ├── medium.json
│   └── devto.json
│
├── index.ts                       ← CLI entry point
├── server.ts                      ← HTTP API server
├── AGENT_CATALOG.md               ← Full agent roadmap
├── MARKETING_AGENT_PLAN.md        ← Marketing agent detailed plan
└── agent_marketplace.md           ← Business plan
```

---

## 🔌 Adding a New Agent

Adding an agent requires **zero changes to existing code**:

### 1. Create the folder
```
agents/my-new-agent/
├── index.ts           ← Main agent class
└── tools/             ← Optional helper tools
    └── my-tool.ts
```

### 2. Implement the agent
```typescript
import { BaseAgent } from "../../core/agent";
import { createMessage, type Message, type TaskPayload, type ResultPayload } from "../../core/message";
import { LLM } from "../../core/llm";

export class MyNewAgent extends BaseAgent {
  private llm: LLM;

  constructor(llm: LLM) {
    super({
      name: "my-new-agent",
      description: "What this agent does",
      version: "1.0.0",
      capabilities: [
        {
          name: "my-action",
          description: "What this action does",
          inputSchema: { topic: "string" },
          outputSchema: { result: "string" },
        },
      ],
    });
    this.llm = llm;
  }

  async handle(message: Message): Promise<Message> {
    const task = message.payload as TaskPayload;
    
    // Your agent logic here
    const result = await this.llm.chat([
      { role: "system", content: "You are..." },
      { role: "user", content: task.input.topic },
    ]);

    return createMessage(this.name, message.from, "result", {
      success: true,
      output: { result: result.content },
    } satisfies ResultPayload, message.id);
  }
}
```

### 3. Register in index.ts and server.ts
```typescript
import { MyNewAgent } from "./agents/my-new-agent";

// In the setup section:
const myAgent = new MyNewAgent(llm);
bus.register(myAgent);
```

That's it. The orchestrator automatically discovers and routes to your new agent.

### 4. Add a campaign strategy (optional)
```
agents/campaign-manager/strategies/my-strategy.ts
```

Register it in `agents/campaign-manager/strategies/index.ts`.

---

## 🔗 Adding a New Integration

### 1. Create JSON config
```json
// integrations/my-platform.json
{
  "name": "my-platform",
  "description": "Publish to My Platform",
  "code": "async function execute(input, credentials) { ... }",
  "requirements": [
    { "name": "MY_PLATFORM_API_KEY", "type": "api_key", "required": true }
  ]
}
```

### 2. Add credentials to .env
```env
MY_PLATFORM_API_KEY=your-key
```

Publisher auto-discovers and loads it. No code changes.

---

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

**Key principles:**
1. Every new agent = just a folder
2. Every new integration = just a JSON file
3. Every new strategy = just a TypeScript file
4. Config controls everything — no hardcoded values
5. Zero changes to existing code when adding new features

---

## 📄 License

MIT — Built by [Nextbase Solutions](https://nextbase.solutions)
