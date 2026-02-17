# Agent Marketplace — Nextbase Solutions

## Vision
Build **full autonomous agents** (not just skills) for the OpenClaw ecosystem. Agents that can plan, use multiple tools, and complete complex workflows on their own.

Nobody on ClawHub is doing agents yet — just skills. **That's our moat.**

---

## Skills vs Agents

```
SKILL = Single tool
  "Translate this text" → done

AGENT = Autonomous worker with multiple skills
  "Launch my product on Product Hunt" →
    → Researches competitors
    → Writes launch copy
    → Creates social posts
    → Schedules everything
    → Monitors launch day
    → Reports back
```

---

## Business Model — SaaS API

- **Agent logic stays on our server** (private, protected)
- **OpenClaw plugin is a thin client** (calls our API)
- **Users get API keys** (free tier + paid tiers)
- **No code exposed** — monopoly protected

### Tier Model

**Free Tier:**
- Basic agents (e.g. simple content writer, summarizer)
- Limited calls/day (e.g. 10/day)
- Watermark or branding on output

**Pro Tier ($X/month):**
- All agents unlocked
- Higher limits (e.g. 500/day)
- Priority processing

**Enterprise:**
- Custom agents, dedicated capacity
- API SLA, support

---

## Architecture

```
┌─────────────────────────────────────────┐
│          Nextbase Agent Server           │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │       MARKETING AGENT            │   │
│  │                                   │   │
│  │  ┌──────┐ ┌──────┐ ┌─────────┐  │   │
│  │  │Research│ │Writer│ │Publisher│  │   │
│  │  └──────┘ └──────┘ └─────────┘  │   │
│  │  ┌──────┐ ┌──────┐ ┌─────────┐  │   │
│  │  │Social│ │Schedule│ │Analytics│  │   │
│  │  └──────┘ └──────┘ └─────────┘  │   │
│  │                                   │   │
│  │  Orchestrator plans & delegates   │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │        SEO AGENT                  │   │
│  │  (own set of internal skills)     │   │
│  └──────────────────────────────────┘   │
│                                          │
│  Auth + Billing + Usage Tracking         │
└──────────────┬──────────────────────────┘
               │ API
               ▼
┌──────────────────────────────────────────┐
│  OpenClaw Plugin (installed by user)      │
│                                           │
│  - Registers as a full AGENT, not skill   │
│  - Has its own orchestrator               │
│  - Receives complex tasks                 │
│  - Streams progress back to user          │
│  - Reports when done                      │
└───────────────────────────────────────────┘
```

---

## Agent Catalog

### 🎯 Marketing Agent
- Product launches, content calendar, social media, outreach
- Uses: research + writing + scheduling + publishing skills internally

### 📈 SEO Agent
- Full SEO strategy — keywords, content, backlinks, monitoring
- Uses: research + content + analytics skills internally

### 🛒 E-commerce Agent
- Product listings, descriptions, pricing research, competitor tracking
- Uses: research + writing + analytics skills internally

### 💻 DevOps Agent
- Monitor deployments, handle alerts, run health checks
- Uses: code execution + monitoring + notification skills internally

### 📊 Data Analyst Agent
- Takes raw data, cleans it, analyzes, generates reports
- Uses: code execution + visualization + writing skills internally

---

## What Makes This Different

| | Skills (everyone else) | Agents (Nextbase) |
|---|---|---|
| **Complexity** | Single task | Multi-step workflows |
| **Autonomy** | Do one thing, return | Plan, execute, adapt |
| **Memory** | Stateless | Remembers context across tasks |
| **Tools** | Is a tool | Uses multiple tools |
| **Value** | Low (easy to replicate) | High (hard to replicate) |
| **Pricing** | Free / cheap | Premium justified |

---

## How Users Experience It

```
User installs: nextbase/marketing-agent

User: "Launch my SaaS on Product Hunt next Tuesday"

Marketing Agent (autonomous):
  1. Researches top PH launches in the category
  2. Writes the tagline, description, first comment
  3. Creates Twitter/LinkedIn announcement posts
  4. Schedules everything for launch day
  5. On launch day — monitors upvotes, replies to comments
  6. End of day — sends performance report

All automatic. User just gave ONE instruction.
```

OpenClaw auto-picks the right agent based on the user's query — same as it picks any other skill. But these are full agents, not single-task tools.

---

## Tech Stack

- **Backend:** Bun + Hono (existing ARISE codebase)
- **Agent Framework:** ARISE message bus + orchestrator
- **Auth:** API keys + JWT
- **Billing:** Stripe
- **Database:** TBD (usage tracking, user management)
- **Deployment:** Docker on AWS/VPS

---

## Roadmap

### Phase 1 — Foundation
- Get 1-2 agents working as an API (use existing ARISE code + Hono server)
- Add auth middleware + API key system
- Add usage tracking

### Phase 2 — First Agent Launch
- Build the OpenClaw plugin (thin client)
- Test end-to-end: install → configure → use
- Launch first agent on ClawHub

### Phase 3 — Monetization
- Add billing (Stripe)
- Free tier + Pro tier
- Dashboard for users (usage, billing, API keys)

### Phase 4 — Scale
- More agents
- Agent memory & learning
- Multi-agent collaboration
- Enterprise features

---

## Components to Build

| Component | Where | Who sees it |
|---|---|---|
| Agent logic | Our server | Nobody (private) |
| API | api.nextbase.solutions | Called by plugin |
| OpenClaw Plugin | ClawHub (public) | Users install it |
| API Key | User's .env | Per-user auth |
| Dashboard | Web app | Users manage account |
