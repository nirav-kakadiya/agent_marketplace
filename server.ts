// Agent Marketplace — HTTP API Server
// Config-driven: reads config.json + env vars

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
import { loadConfig, resolveKeys, printConfig } from "./core/config";
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
import { SEOAgent } from "./agents/seo";
import { EmailMarketingAgent } from "./agents/email-marketing";
import { ContentRepurposerAgent } from "./agents/content-repurposer";
import { SocialMediaManagerAgent } from "./agents/social-media-manager";
import { SalesAgent } from "./agents/sales";
import { EcommerceAgent } from "./agents/ecommerce";
import { BrandDesignAgent } from "./agents/brand-design";
import { DataAnalystAgent } from "./agents/data-analyst";
import { DevOpsAgent } from "./agents/devops";
import type { SearchConfig } from "./agents/researcher/tools/web-search";

const ROOT = import.meta.dir || __dirname;

// --- Load config ---
const config = await loadConfig(join(ROOT, "config.json"));
const keys = resolveKeys(config);
printConfig(config, keys);

// --- Initialize core ---
const llm = new LLM({
  provider: keys.llmProvider,
  apiKey: keys.llmApiKey,
  model: keys.llmModel,
  baseUrl: keys.llmBaseUrl,
});

const searchConfig: SearchConfig = {
  provider: keys.searchProvider as any,
  apiKey: keys.searchApiKey,
};

const memory = new Memory(join(ROOT, "memory"));
const bus = new MessageBus();
await memory.init();

const tenantManager = new TenantManager(join(ROOT, "data", "tenants"));
await tenantManager.init();

const auth = new Auth(join(ROOT, "data", "auth"), config.authEnabled);
await auth.init();

// --- Register agents ---
const orchestrator = new OrchestratorAgent(llm, bus, memory);
const researcher = new ResearcherAgent(llm, searchConfig);
const writer = new WriterAgent(llm, memory, searchConfig);
const editor = new EditorAgent(llm);
const publisher = new PublisherAgent(join(ROOT, "integrations"), join(ROOT, "output"));

for (const [, creds] of Object.entries(config.platforms)) {
  for (const [key, value] of Object.entries(creds)) {
    publisher.setCredential(key, value);
  }
}
await publisher.init();

bus.register(orchestrator);
bus.register(researcher);
bus.register(writer);
bus.register(editor);
bus.register(publisher);

if (config.features.socialWriter) bus.register(new SocialWriterAgent(llm, memory));
if (config.features.brandManager) bus.register(new BrandManagerAgent(llm, memory));

let scheduler: SchedulerAgent | undefined;
if (config.features.scheduling) {
  scheduler = new SchedulerAgent(memory, join(ROOT, "data"));
  await scheduler.init();
  bus.register(scheduler);
}

if (config.features.analytics) bus.register(new AnalyticsAgent(memory));

// Additional agents
if (config.features.seoTools) bus.register(new SEOAgent(llm, memory, searchConfig));
bus.register(new EmailMarketingAgent(llm, memory));
bus.register(new ContentRepurposerAgent(llm));
bus.register(new SocialMediaManagerAgent(llm, memory, searchConfig));
bus.register(new SalesAgent(llm, memory, searchConfig));
bus.register(new EcommerceAgent(llm, searchConfig));
bus.register(new BrandDesignAgent(llm, memory, searchConfig));
bus.register(new DataAnalystAgent(llm));
bus.register(new DevOpsAgent(llm));

let campaignManager: CampaignManagerAgent | undefined;
if (config.features.campaigns) {
  campaignManager = new CampaignManagerAgent(llm, bus, memory, join(ROOT, "data", "campaigns"));
  await campaignManager.init();
  bus.register(campaignManager);
}

// Start scheduler ticker
if (scheduler) {
  scheduler.startTicker(async (job) => {
    const msg = createMessage("scheduler", "orchestrator", "task", {
      action: "orchestrate",
      input: { request: job.request },
    });
    await bus.send(msg);
  });
}

console.log(`\n✅ ${bus.listAgentNames().length} agents ready\n`);

// --- HTTP Server ---
const app = new Hono();
app.use("*", cors());

// Auth middleware
const authMiddleware = async (c: any, next: any) => {
  if (!config.authEnabled) return next();
  const key = c.req.header("Authorization")?.replace("Bearer ", "") || c.req.header("X-API-Key");
  const user = auth.authenticateApiKey(key || "");
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  c.set("user", user);
  return next();
};

// === Main endpoint — OpenClaw calls this ===
app.post("/api/v1/run", authMiddleware, async (c) => {
  const body = await c.req.json();

  // Hybrid: if user sends their own keys, use them for this request
  // In "saas" mode, always use server keys (ignore user keys)
  // In "free" or "hybrid", prefer user keys
  let requestBus = bus;

  if (body.userKeys?.llmApiKey && config.billing !== "saas") {
    // Create a per-request agent pipeline with the user's keys
    const userLLM = new LLM({
      provider: body.userKeys.llmProvider || keys.llmProvider,
      apiKey: body.userKeys.llmApiKey,
      model: body.userKeys.llmModel || keys.llmModel,
    });
    const userSearchConfig: SearchConfig = {
      provider: (body.userKeys.searchProvider || keys.searchProvider) as any,
      apiKey: body.userKeys.searchApiKey || keys.searchApiKey,
    };

    // Build a temporary bus with user's keys
    requestBus = new MessageBus();
    const reqMemory = new Memory(join(ROOT, "memory"));
    await reqMemory.init();

    requestBus.register(new OrchestratorAgent(userLLM, requestBus, reqMemory));
    requestBus.register(new ResearcherAgent(userLLM, userSearchConfig));
    requestBus.register(new WriterAgent(userLLM, reqMemory, userSearchConfig));
    requestBus.register(new EditorAgent(userLLM));
    requestBus.register(publisher); // reuse publisher (uses platform creds, not LLM)
    if (config.features.socialWriter) requestBus.register(new SocialWriterAgent(userLLM, reqMemory));
    if (config.features.brandManager) requestBus.register(new BrandManagerAgent(userLLM, reqMemory));
    if (config.features.analytics) requestBus.register(new AnalyticsAgent(reqMemory));
    if (config.features.campaigns) {
      const cm = new CampaignManagerAgent(userLLM, requestBus, reqMemory, join(ROOT, "data", "campaigns"));
      await cm.init();
      requestBus.register(cm);
    }
    if (config.features.seoTools) requestBus.register(new SEOAgent(userLLM, reqMemory, userSearchConfig));
    requestBus.register(new EmailMarketingAgent(userLLM, reqMemory));
    requestBus.register(new ContentRepurposerAgent(userLLM));
    requestBus.register(new SocialMediaManagerAgent(userLLM, reqMemory, userSearchConfig));
    requestBus.register(new SalesAgent(userLLM, reqMemory, userSearchConfig));
    requestBus.register(new EcommerceAgent(userLLM, userSearchConfig));
    requestBus.register(new BrandDesignAgent(userLLM, reqMemory, userSearchConfig));
    requestBus.register(new DataAnalystAgent(userLLM));
    requestBus.register(new DevOpsAgent(userLLM));
  }

  const msg = createMessage("api", "orchestrator", "task", {
    action: "orchestrate",
    input: { request: body.request || body.topic, ...body },
  });
  const result = await requestBus.send(msg);
  return c.json(result.payload, result.type === "error" ? 400 : 200);
});

// === Health ===
app.get("/api/v1/health", (c) => c.json({
  status: "ok",
  billing: config.billing,
  agents: bus.listAgentNames().length,
  features: config.features,
}));

// === Config (non-sensitive) ===
app.get("/api/v1/config", (c) => c.json({
  billing: config.billing,
  execution: config.execution,
  features: config.features,
  limits: config.limits,
  agents: bus.listAgentNames(),
}));

// === Campaigns ===
app.post("/api/v1/campaigns", authMiddleware, async (c) => {
  const body = await c.req.json();
  const msg = createMessage("api", "campaign-manager", "task", { action: "create-campaign", input: body });
  const result = await bus.send(msg);
  return c.json(result.payload, result.type === "error" ? 400 : 200);
});

app.get("/api/v1/campaigns", authMiddleware, async (c) => {
  const msg = createMessage("api", "campaign-manager", "task", { action: "list-campaigns", input: {} });
  const result = await bus.send(msg);
  return c.json(result.payload);
});

app.get("/api/v1/campaigns/:id", authMiddleware, async (c) => {
  const msg = createMessage("api", "campaign-manager", "task", { action: "campaign-status", input: { campaignId: c.req.param("id") } });
  const result = await bus.send(msg);
  return c.json(result.payload, result.type === "error" ? 404 : 200);
});

app.post("/api/v1/campaigns/:id/run", authMiddleware, async (c) => {
  const msg = createMessage("api", "campaign-manager", "task", { action: "run-campaign", input: { campaignId: c.req.param("id") } });
  const result = await bus.send(msg);
  return c.json(result.payload, result.type === "error" ? 400 : 200);
});

app.post("/api/v1/campaigns/:id/pause", authMiddleware, async (c) => {
  const msg = createMessage("api", "campaign-manager", "task", { action: "pause-campaign", input: { campaignId: c.req.param("id") } });
  const result = await bus.send(msg);
  return c.json(result.payload);
});

// === Quick endpoints ===
app.post("/api/v1/generate", authMiddleware, async (c) => {
  const body = await c.req.json();
  const msg = createMessage("api", "orchestrator", "task", { action: "orchestrate", input: body });
  const result = await bus.send(msg);
  return c.json(result.payload, result.type === "error" ? 400 : 200);
});

app.post("/api/v1/research", authMiddleware, async (c) => {
  const body = await c.req.json();
  const msg = createMessage("api", "researcher", "task", { action: body.action || "research", input: body });
  const result = await bus.send(msg);
  return c.json(result.payload, result.type === "error" ? 400 : 200);
});

app.post("/api/v1/seo/keywords", authMiddleware, async (c) => {
  const body = await c.req.json();
  const msg = createMessage("api", "writer", "task", { action: "keyword-research", input: body });
  const result = await bus.send(msg);
  return c.json(result.payload, result.type === "error" ? 400 : 200);
});

// === Agents & Strategies ===
app.get("/api/v1/agents", authMiddleware, (c) => {
  return c.json({ agents: bus.getAllAgents().map((a) => ({ name: a.name, description: a.description, version: a.version, capabilities: a.capabilities })) });
});

app.get("/api/v1/strategies", authMiddleware, async (c) => {
  const msg = createMessage("api", "campaign-manager", "task", { action: "list-strategies", input: {} });
  const result = await bus.send(msg);
  return c.json(result.payload);
});

// === Tenants ===
app.get("/api/v1/tenants", authMiddleware, (c) => c.json({ tenants: tenantManager.list() }));
app.post("/api/v1/tenants", authMiddleware, async (c) => {
  const tenant = await tenantManager.create(await c.req.json());
  return c.json(tenant, 201);
});

// === Auth ===
app.post("/api/v1/auth/login", async (c) => {
  const { apiKey } = await c.req.json();
  const session = auth.login(apiKey);
  return session ? c.json(session) : c.json({ error: "Invalid API key" }, 401);
});

// === Static ===
app.use("/*", serveStatic({ root: "./public" }));

console.log(`🌐 Server starting on port ${config.port}`);

export default {
  port: config.port,
  fetch: app.fetch,
};
