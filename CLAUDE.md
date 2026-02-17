# ARISE — System Rules & Architecture Guide

> **Read this ENTIRE file before making ANY changes to the codebase.**
> This is the constitution. Break these rules and the system breaks.

---

## 🏛️ Core Philosophy

**"If adding something new requires changing something old, the architecture is wrong."**

ARISE is a message-bus agent system. Every component communicates through messages. Nothing talks directly to anything else. This is what makes it infinitely scalable.

---

## 🔴 ABSOLUTE RULES (Never Break These)

### 1. Every Agent Implements BaseAgent
```typescript
import { BaseAgent } from "../../core/agent";

class MyAgent extends BaseAgent {
  async handle(message: Message): Promise<Message> {
    // THE ONLY METHOD. Always returns a Message.
  }
}
```
- No exceptions. No shortcuts. No "quick hacks."
- A single agent or a team of 1000 agents — from OUTSIDE, same interface.

### 2. Agents Communicate ONLY Through the Message Bus
```typescript
// ✅ CORRECT
const response = await bus.send(createMessage("me", "other-agent", "task", payload));

// ❌ WRONG — NEVER DO THIS
const response = await otherAgent.handle(message); // Direct call
const response = await otherAgent.doSomething();   // Direct method call
```
- Agents don't import other agents
- Agents don't call other agents directly
- Agents don't know what other agents exist
- The orchestrator is the ONLY agent that knows about routing

### 3. Messages Are the ONLY Communication Format
```typescript
interface Message {
  id: string;       // unique
  from: string;     // who sent it
  to: string;       // who receives it
  type: MessageType; // task | result | error | query | register | discover | event
  payload: any;     // the data
  replyTo?: string; // for responses
  timestamp: string;
}
```
- No custom protocols
- No side channels
- No shared state between agents (use Memory if needed)

### 4. Core Directory is SACRED
```
core/
├── agent.ts      ← DO NOT MODIFY unless adding to BaseAgent interface
├── message.ts    ← DO NOT MODIFY unless adding a new MessageType
├── bus.ts        ← DO NOT MODIFY unless adding bus features (middleware, etc.)
├── memory.ts     ← Extend carefully, never break existing API
├── llm.ts        ← Can add providers, never change existing interface
└── executor.ts   ← Can improve safety, never change execute signature
```
- Changing core = potentially breaking ALL agents
- If you think core needs changing, you're probably doing it wrong
- Add new files to core/ only if they're truly universal

### 5. One Agent = One Folder
```
agents/
├── my-agent/
│   ├── index.ts        ← REQUIRED: exports the agent class
│   ├── prompts.ts      ← Optional: LLM prompts
│   ├── helpers.ts      ← Optional: utility functions
│   └── README.md       ← Optional: documentation
```
- Agent folder name = agent name (lowercase, kebab-case)
- `index.ts` MUST export a class extending BaseAgent
- Agent can have internal helper files
- Agent MUST NOT import from other agent folders

---

## 📐 How to Add a New Agent

### Step 1: Create the folder
```bash
mkdir agents/my-new-agent
```

### Step 2: Write the agent
```typescript
// agents/my-new-agent/index.ts
import { BaseAgent } from "../../core/agent";
import { createMessage, type Message, type TaskPayload, type ResultPayload } from "../../core/message";

export class MyNewAgent extends BaseAgent {
  constructor(/* dependencies */) {
    super({
      name: "my-new-agent",           // MUST match folder name
      description: "What this agent does",
      version: "1.0.0",
      capabilities: [
        {
          name: "capability-name",      // what it can do
          description: "Description",
          inputSchema: { key: "type" },
          outputSchema: { key: "type" },
        },
      ],
    });
  }

  async handle(message: Message): Promise<Message> {
    const task = message.payload as TaskPayload;

    // Do your work here...

    return createMessage(
      this.name,          // from
      message.from,       // to (reply to sender)
      "result",           // type
      {
        success: true,
        output: { /* your output */ },
      } satisfies ResultPayload,
      message.id          // replyTo
    );
  }
}
```

### Step 3: Register in index.ts
```typescript
import { MyNewAgent } from "./agents/my-new-agent";

const myAgent = new MyNewAgent(/* deps */);
bus.register(myAgent);
```

### Step 4: Done. Nothing else changes.

---

## 📐 How to Add a New Integration

Integrations are JSON files in `integrations/` created by the skill-builder agent.

### Automatic (preferred):
```bash
bun run index.ts --build service-name
```

### Manual:
```json
// integrations/service-name.json
{
  "name": "service-name",
  "description": "What it does",
  "code": "async function execute(input, credentials) { ... return { success: true, data: result }; }",
  "requirements": [
    { "name": "API_KEY", "description": "API key", "type": "api_key", "required": true }
  ],
  "createdAt": "2026-01-01T00:00:00Z"
}
```

**Integration code rules:**
- MUST export an `execute(input, credentials)` function
- MUST use only `fetch()` for HTTP (no imports, no require)
- MUST handle errors with try/catch
- MUST return `{ success: true/false, data/error }`
- MUST use `credentials` object for all secrets (never hardcode)
- MUST support `input.action` for different operations

---

## 📐 How to Add a New LLM Provider

### Step 1: Add to `core/llm.ts`
```typescript
// Add the provider type
export type LLMProvider = "openai" | "anthropic" | "your-provider";

// Add the method
private async chatYourProvider(messages: LLMMessage[]): Promise<LLMResponse> {
  // Implementation
}
```

### Step 2: Update the router in `chat()`
```typescript
async chat(messages: LLMMessage[]): Promise<LLMResponse> {
  if (this.provider === "anthropic") return this.chatAnthropic(messages);
  if (this.provider === "your-provider") return this.chatYourProvider(messages);
  return this.chatOpenAI(messages);
}
```

### Step 3: Update `.env.example`

**Rules:**
- NEVER change the `LLMMessage` or `LLMResponse` interfaces
- NEVER change the `chat()` method signature
- All providers MUST return the same response format

---

## 📐 How to Add Middleware

Middleware wraps every message on the bus. Use for logging, monitoring, rate limiting, etc.

```typescript
// In index.ts
bus.use(async (message, next) => {
  // Before
  console.log(`${message.from} → ${message.to}`);
  
  const result = await next(); // Execute
  
  // After
  console.log(`Done in ${Date.now() - start}ms`);
  
  return result;
});
```

---

## 🗂️ File Structure (Current)

```
arise/
├── core/                     ← Foundation (SACRED — rarely changes)
│   ├── agent.ts              ← BaseAgent interface
│   ├── message.ts            ← Message types
│   ├── bus.ts                ← Message Bus
│   ├── memory.ts             ← Persistent memory
│   ├── llm.ts                ← LLM providers
│   └── executor.ts           ← Safe code execution
│
├── agents/                   ← Plug-and-play agents
│   ├── orchestrator/         ← Plans + delegates tasks
│   ├── researcher/           ← Finds information
│   ├── writer/               ← Writes content
│   ├── editor/               ← Improves content
│   ├── publisher/            ← Publishes via integrations
│   └── skill-builder/        ← Self-builds integrations
│
├── integrations/             ← Auto-generated connectors (JSON)
├── memory/                   ← Persistent agent memory (JSON)
│
├── index.ts                  ← Entry point + agent registration
├── .env.example              ← Environment variables template
├── CLAUDE.md                 ← THIS FILE — the constitution
└── README.md                 ← User-facing documentation
```

---

## 🔒 Security Rules

1. **Never hardcode API keys** — always use environment variables or the credential system
2. **Integration code runs in a sandbox** — but be careful with what you execute
3. **Never let agents access the filesystem directly** — use Memory for persistence
4. **Never let agents modify core/ files** — they can only create in agents/ and integrations/
5. **Log everything** — every message goes through the bus and can be audited

---

## 🧠 Memory Rules

- Memory is shared but tagged by agent name
- Agents should namespace their keys: `agent-name:key`
- Don't store secrets in memory
- Memory is for learning (preferences, patterns, performance data)
- Keep entries small — memory is loaded into LLM context

---

## 🚫 Anti-Patterns (Never Do These)

| ❌ Don't | ✅ Do Instead |
|---|---|
| Import one agent into another | Send message through bus |
| Add methods to BaseAgent for one agent | Add helpers inside the agent's folder |
| Store state in global variables | Use Memory |
| Modify core/ for agent-specific needs | Extend in the agent's folder |
| Create a "god agent" that does everything | Split into specialized agents |
| Hardcode service URLs/keys | Use credentials/env vars |
| Skip the Message format | Always use createMessage() |
| Put agent logic in index.ts | Keep index.ts as just wiring |

---

## 📈 Scaling Guide

### Adding capabilities to an agent:
→ Add to its `capabilities` array + handle in its `handle()` method

### Agent getting too complex:
→ Split into multiple agents (same interface from outside)

### Need parallel execution:
→ Orchestrator sends multiple messages simultaneously (Promise.all)

### Need agent-to-agent collaboration:
→ Go through the bus. Agent A → bus → Agent B → bus → Agent A

### Need a team of agents for one role:
→ Create a "team agent" that internally manages sub-agents but exposes the same BaseAgent interface

### Need different LLM per agent:
→ Pass different LLM instances to each agent constructor

---

## 🎯 Vision

```
Layer 1 ✅  — Orchestrator + specialized agents + message bus
Layer 2     — Per-agent memory + learning from past tasks
Layer 3     — Agents become teams (researcher → research team)
Layer N     — Same architecture. Same rules. Infinite scale.
```

The architecture NEVER changes. Only agents are added, improved, or composed into teams.

**That's the whole point.**
