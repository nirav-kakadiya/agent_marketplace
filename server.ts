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
import { TenantStore } from "./core/tenant";
import { Auth } from "./core/auth";
import { loadConfig, resolveKeys, printConfig } from "./core/config";
import { checkSetup, formatSetupStatus, canAgentWork } from "./core/setup";

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

const tenantStore = new TenantStore(join(ROOT, "data"));
await tenantStore.init();

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

  // ── Tenant Identification ──
  // Every request is tied to a tenant. No tenant = no service.
  const tenantKey = c.req.header("X-Tenant-Key") || body.tenantKey;
  const tenant = tenantKey ? tenantStore.getByApiKey(tenantKey) : undefined;

  // Check setup first — guide user if not configured
  const setupResult = checkSetup(config);
  if (!setupResult.ready && !body.userKeys?.llmApiKey && !tenant?.config.llmApiKey) {
    return c.json({
      success: false,
      setup_required: true,
      message: setupResult.message,
      formatted: formatSetupStatus(setupResult),
      missing: setupResult.missing.map(m => ({ name: m.name, envVar: m.envVar, howToGet: m.howToGet })),
    }, 428); // 428 = Precondition Required
  }

  // ── Tenant Usage Check ──
  if (tenant) {
    const usage = await tenantStore.trackUsage(tenant.id);
    if (!usage.allowed) {
      return c.json({ success: false, error: "rate_limit", message: usage.reason }, 429);
    }
    // Check agent access
    if (body.agent) {
      const access = tenantStore.canUseAgent(tenant.id, body.agent);
      if (!access.allowed) {
        return c.json({ success: false, error: "plan_limit", message: access.reason }, 403);
      }
    }
  }

  // ── Tenant-Isolated Context ──
  // Each tenant gets ONLY their own memory/context injected into prompts
  // NEVER mix tenant contexts — this prevents bias and data leaks
  const tenantContext = tenant ? tenantStore.getTenantContext(tenant.id) : "";

  // Hybrid: if user sends their own keys, use them for this request
  let requestBus = bus;

  if ((body.userKeys?.llmApiKey || tenant?.config.llmApiKey) && config.billing !== "saas") {
    // Create per-request pipeline with tenant/user keys (tenant keys take priority)
    const reqLlmKey = tenant?.config.llmApiKey || body.userKeys?.llmApiKey || keys.llmApiKey;
    const reqSearchKey = tenant?.config.searchApiKey || body.userKeys?.searchApiKey || keys.searchApiKey;

    const userLLM = new LLM({
      provider: tenant?.config.llmProvider || body.userKeys?.llmProvider || keys.llmProvider,
      apiKey: reqLlmKey,
      model: tenant?.config.llmModel || body.userKeys?.llmModel || keys.llmModel,
    });
    const userSearchConfig: SearchConfig = {
      provider: (tenant?.config.searchProvider || body.userKeys?.searchProvider || keys.searchProvider) as any,
      apiKey: reqSearchKey,
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

  // Build request with tenant-isolated context
  const request = body.request || body.topic;
  const contextualRequest = tenantContext
    ? `${tenantContext}\n---\nUser request: ${request}`
    : request;

  const msg = createMessage("api", "orchestrator", "task", {
    action: "orchestrate",
    input: { request: contextualRequest, ...body, tenantId: tenant?.id },
  });
  const result = await requestBus.send(msg);

  // Learn from this interaction (update tenant memory)
  if (tenant && result.type === "result") {
    await tenantStore.updateMemory(tenant.id, {
      history: { pastTopics: [request], pastOutputTypes: [body.agent || "orchestrator"], feedbackLog: [] },
    });
  }

  return c.json(result.payload, result.type === "error" ? 400 : 200);
});

// === Setup Check (first thing OpenClaw calls) ===
app.get("/api/v1/setup", (c) => {
  const result = checkSetup(config);
  return c.json(result);
});

app.get("/api/v1/setup/formatted", (c) => {
  const result = checkSetup(config);
  return c.json({ message: formatSetupStatus(result), ready: result.ready });
});

// Check if specific agent can work
app.get("/api/v1/setup/agent/:name", (c) => {
  const result = canAgentWork(c.req.param("name"), config);
  return c.json(result);
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
app.get("/api/v1/tenants", authMiddleware, (c) => c.json({ tenants: tenantStore.list().map(t => ({ id: t.id, name: t.name, plan: t.plan.name, usage: t.usage, active: t.active })) }));

app.post("/api/v1/tenants", authMiddleware, async (c) => {
  const body = await c.req.json();
  const tenant = await tenantStore.create(body.name, body.email, body.plan);
  return c.json({ id: tenant.id, apiKey: tenant.apiKey, name: tenant.name, plan: tenant.plan.name }, 201);
});

app.get("/api/v1/tenants/:id", authMiddleware, (c) => {
  const tenant = tenantStore.getById(c.req.param("id"));
  if (!tenant) return c.json({ error: "Tenant not found" }, 404);
  return c.json({ id: tenant.id, name: tenant.name, plan: tenant.plan, usage: tenant.usage, memory: tenant.memory, active: tenant.active });
});

// Tenant updates their brand/preferences
app.patch("/api/v1/tenants/:id/memory", authMiddleware, async (c) => {
  const body = await c.req.json();
  await tenantStore.updateMemory(c.req.param("id"), body);
  return c.json({ success: true });
});

// Tenant usage
app.get("/api/v1/tenants/:id/usage", authMiddleware, (c) => {
  const tenant = tenantStore.getById(c.req.param("id"));
  if (!tenant) return c.json({ error: "Tenant not found" }, 404);
  return c.json(tenant.usage);
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
