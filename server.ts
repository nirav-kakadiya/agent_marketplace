// Agent Marketplace — HTTP API Server
// REST API for campaigns, content generation, and agent management

import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { join } from "path";

import { MessageBus } from "./core/bus";
import { Memory } from "./core/memory";
import { LLM } from "./core/llm";
import { createMessage } from "./core/message";
import { TenantManager } from "./core/tenant";
import { Auth } from "./core/auth";
import type { SearchConfig } from "./agents/researcher/tools/web-search";

import { OrchestratorAgent } from "./agents/orchestrator";
import { ResearcherAgent } from "./agents/researcher";
import { WriterAgent } from "./agents/writer";
import { EditorAgent } from "./agents/editor";
import { PublisherAgent } from "./agents/publisher";
import { SocialWriterAgent } from "./agents/social-writer";
import { BrandManagerAgent } from "./agents/brand-manager";
import { SchedulerAgent } from "./agents/scheduler";
import { AnalyticsAgent } from "./agents/analytics";
import { CampaignManagerAgent } from "./agents/campaign-manager";

const ROOT = import.meta.dir || __dirname;
const PORT = parseInt(process.env.PORT || "3000");

// --- Config ---
const apiKey = process.env.LLM_API_KEY || process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || "";
const provider = process.env.LLM_PROVIDER || (process.env.OPENROUTER_API_KEY ? "openrouter" : process.env.ANTHROPIC_API_KEY ? "anthropic" : "openai");
const model = process.env.LLM_MODEL || undefined;
const baseUrl = process.env.LLM_BASE_URL || undefined;

if (!apiKey) {
  console.error("❌ Set LLM_API_KEY");
  process.exit(1);
}

const searchConfig: SearchConfig = {
  provider: (process.env.SEARCH_PROVIDER as any) || "brave",
  apiKey: process.env.SEARCH_API_KEY || "",
};

// --- Initialize ---
const llm = new LLM({ provider, apiKey, model, baseUrl });
const memory = new Memory(join(ROOT, "memory"));
const bus = new MessageBus();
await memory.init();

const tenantManager = new TenantManager(join(ROOT, "data", "tenants"));
await tenantManager.init();

const authEnabled = process.env.AUTH_ENABLED !== "false";
const auth = new Auth(join(ROOT, "data", "auth"), authEnabled);
await auth.init();

// --- Register agents ---
const orchestrator = new OrchestratorAgent(llm, bus, memory);
const researcher = new ResearcherAgent(llm, searchConfig);
const writer = new WriterAgent(llm, memory, searchConfig);
const editor = new EditorAgent(llm);
const publisher = new PublisherAgent(join(ROOT, "integrations"), join(ROOT, "output"));
const socialWriter = new SocialWriterAgent(llm, memory);
const brandManager = new BrandManagerAgent(llm, memory);
const scheduler = new SchedulerAgent(memory, join(ROOT, "data"));
const analytics = new AnalyticsAgent(memory);
const campaignManager = new CampaignManagerAgent(llm, bus, memory, join(ROOT, "data", "campaigns"));

const credentialPrefixes = ["WORDPRESS_", "TWITTER_", "LINKEDIN_", "MEDIUM_", "DEVTO_"];
for (const [key, value] of Object.entries(process.env)) {
  if (value && credentialPrefixes.some((p) => key.startsWith(p))) {
    publisher.setCredential(key, value);
  }
}

await publisher.init();
await scheduler.init();
await campaignManager.init();

bus.register(orchestrator);
bus.register(researcher);
bus.register(writer);
bus.register(editor);
bus.register(publisher);
bus.register(socialWriter);
bus.register(brandManager);
bus.register(scheduler);
bus.register(analytics);
bus.register(campaignManager);

// Start scheduler
scheduler.startTicker(async (job) => {
  console.log(`⏰ Running scheduled job: ${job.name}`);
  const msg = createMessage("scheduler", "orchestrator", "task", {
    action: "orchestrate",
    input: { request: job.request },
  });
  await bus.send(msg);
});

console.log(`\n✅ ${bus.listAgentNames().length} agents ready\n`);

// --- HTTP Server ---
const app = new Hono();
app.use("*", cors());

// Auth middleware
const authMiddleware = async (c: any, next: any) => {
  if (!authEnabled) return next();
  const key = c.req.header("Authorization")?.replace("Bearer ", "") || c.req.header("X-API-Key");
  const user = auth.authenticateApiKey(key || "");
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  c.set("user", user);
  return next();
};

// === Health ===
app.get("/api/v1/health", (c) => c.json({ status: "ok", agents: bus.listAgentNames().length }));

// === Campaigns ===
app.post("/api/v1/campaigns", authMiddleware, async (c) => {
  const body = await c.req.json();
  const msg = createMessage("api", "campaign-manager", "task", {
    action: "create-campaign",
    input: body,
  });
  const result = await bus.send(msg);
  return c.json(result.payload, result.type === "error" ? 400 : 200);
});

app.get("/api/v1/campaigns", authMiddleware, async (c) => {
  const msg = createMessage("api", "campaign-manager", "task", {
    action: "list-campaigns",
    input: {},
  });
  const result = await bus.send(msg);
  return c.json(result.payload);
});

app.get("/api/v1/campaigns/:id", authMiddleware, async (c) => {
  const msg = createMessage("api", "campaign-manager", "task", {
    action: "campaign-status",
    input: { campaignId: c.req.param("id") },
  });
  const result = await bus.send(msg);
  return c.json(result.payload, result.type === "error" ? 404 : 200);
});

app.post("/api/v1/campaigns/:id/run", authMiddleware, async (c) => {
  const msg = createMessage("api", "campaign-manager", "task", {
    action: "run-campaign",
    input: { campaignId: c.req.param("id") },
  });
  const result = await bus.send(msg);
  return c.json(result.payload, result.type === "error" ? 400 : 200);
});

app.post("/api/v1/campaigns/:id/pause", authMiddleware, async (c) => {
  const msg = createMessage("api", "campaign-manager", "task", {
    action: "pause-campaign",
    input: { campaignId: c.req.param("id") },
  });
  const result = await bus.send(msg);
  return c.json(result.payload);
});

// === Quick Generation ===
app.post("/api/v1/generate", authMiddleware, async (c) => {
  const body = await c.req.json();
  const msg = createMessage("api", "orchestrator", "task", {
    action: "orchestrate",
    input: body,
  });
  const result = await bus.send(msg);
  return c.json(result.payload, result.type === "error" ? 400 : 200);
});

// === Research ===
app.post("/api/v1/research", authMiddleware, async (c) => {
  const body = await c.req.json();
  const msg = createMessage("api", "researcher", "task", {
    action: body.action || "research",
    input: body,
  });
  const result = await bus.send(msg);
  return c.json(result.payload, result.type === "error" ? 400 : 200);
});

// === SEO ===
app.post("/api/v1/seo/keywords", authMiddleware, async (c) => {
  const body = await c.req.json();
  const msg = createMessage("api", "writer", "task", {
    action: "keyword-research",
    input: body,
  });
  const result = await bus.send(msg);
  return c.json(result.payload, result.type === "error" ? 400 : 200);
});

app.post("/api/v1/seo/serp", authMiddleware, async (c) => {
  const body = await c.req.json();
  const msg = createMessage("api", "writer", "task", {
    action: "serp-analysis",
    input: body,
  });
  const result = await bus.send(msg);
  return c.json(result.payload, result.type === "error" ? 400 : 200);
});

// === Strategies ===
app.get("/api/v1/strategies", authMiddleware, async (c) => {
  const msg = createMessage("api", "campaign-manager", "task", {
    action: "list-strategies",
    input: {},
  });
  const result = await bus.send(msg);
  return c.json(result.payload);
});

// === Agents ===
app.get("/api/v1/agents", authMiddleware, (c) => {
  return c.json({
    agents: bus.getAllAgents().map((a) => ({
      name: a.name,
      description: a.description,
      version: a.version,
      capabilities: a.capabilities,
    })),
  });
});

// === Tenants ===
app.get("/api/v1/tenants", authMiddleware, (c) => c.json({ tenants: tenantManager.list() }));

app.post("/api/v1/tenants", authMiddleware, async (c) => {
  const body = await c.req.json();
  const tenant = await tenantManager.create(body);
  return c.json(tenant, 201);
});

app.put("/api/v1/tenants/:id", authMiddleware, async (c) => {
  const updated = await tenantManager.update(c.req.param("id"), await c.req.json());
  return updated ? c.json(updated) : c.json({ error: "Not found" }, 404);
});

// === Auth ===
app.post("/api/v1/auth/login", async (c) => {
  const { apiKey } = await c.req.json();
  const session = auth.login(apiKey);
  return session ? c.json(session) : c.json({ error: "Invalid API key" }, 401);
});

// === Static files ===
app.use("/*", serveStatic({ root: "./public" }));

// --- Start ---
console.log(`🌐 Server starting on port ${PORT}`);

export default {
  port: PORT,
  fetch: app.fetch,
};
