// Agent Marketplace — Marketing Agent
// Config-driven: change config.json or env vars to switch billing/execution model

import { join } from "path";
import { MessageBus } from "./core/bus";
import { Memory } from "./core/memory";
import { LLM } from "./core/llm";
import { createMessage } from "./core/message";
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

const ROOT = import.meta.dir || __dirname;

async function main() {
  console.log("🚀 Agent Marketplace — Marketing Agent\n");

  // --- Load config (ONE source of truth) ---
  const config = await loadConfig(join(ROOT, "config.json"));
  const keys = resolveKeys(config);
  printConfig(config, keys);

  // --- Initialize core using resolved keys ---
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

  if (!keys.searchApiKey) {
    console.warn("⚠️  No search API key — researcher will have limited capabilities\n");
  }

  const memory = new Memory(join(ROOT, "memory"));
  const bus = new MessageBus();
  await memory.init();

  // --- Register agents (only enabled features) ---
  const orchestrator = new OrchestratorAgent(llm, bus, memory);
  const researcher = new ResearcherAgent(llm, searchConfig);
  const writer = new WriterAgent(llm, memory, searchConfig);
  const editor = new EditorAgent(llm);
  const publisher = new PublisherAgent(join(ROOT, "integrations"), join(ROOT, "output"));
  
  bus.register(orchestrator);
  bus.register(researcher);
  bus.register(writer);
  bus.register(editor);

  // Load platform credentials
  for (const [platform, creds] of Object.entries(config.platforms)) {
    for (const [key, value] of Object.entries(creds)) {
      publisher.setCredential(key, value);
    }
  }
  await publisher.init();
  if (config.features.publishing) bus.register(publisher);

  if (config.features.socialWriter) {
    const socialWriter = new SocialWriterAgent(llm, memory);
    bus.register(socialWriter);
  }

  if (config.features.brandManager) {
    const brandManager = new BrandManagerAgent(llm, memory);
    bus.register(brandManager);
  }

  if (config.features.scheduling) {
    const scheduler = new SchedulerAgent(memory, join(ROOT, "data"));
    await scheduler.init();
    bus.register(scheduler);
  }

  if (config.features.analytics) {
    const analytics = new AnalyticsAgent(memory);
    bus.register(analytics);
  }

  if (config.features.campaigns) {
    const campaignManager = new CampaignManagerAgent(llm, bus, memory, join(ROOT, "data", "campaigns"));
    await campaignManager.init();
    bus.register(campaignManager);
  }

  console.log(`\n✅ ${bus.listAgentNames().length} agents ready: ${bus.listAgentNames().join(", ")}\n`);

  // --- CLI ---
  const args = process.argv.slice(2);

  if (args.includes("--agents")) {
    console.log(bus.describeAll());
    return;
  }
  if (args.includes("--strategies")) {
    const msg = createMessage("cli", "campaign-manager", "task", { action: "list-strategies", input: {} });
    const result = await bus.send(msg);
    console.log(JSON.stringify(result.payload, null, 2));
    return;
  }
  if (args.includes("--campaigns")) {
    const msg = createMessage("cli", "campaign-manager", "task", { action: "list-campaigns", input: {} });
    const result = await bus.send(msg);
    console.log(JSON.stringify(result.payload, null, 2));
    return;
  }
  if (args.includes("--config")) {
    console.log(JSON.stringify({ ...config, server: { ...config.server, llmApiKey: "***", searchApiKey: "***" } }, null, 2));
    return;
  }

  const request = args.filter((a) => !a.startsWith("--")).join(" ");
  if (!request) {
    console.log("Usage:");
    console.log('  bun run index.ts "Write a blog about AI trends"');
    console.log('  bun run index.ts "Launch my SaaS on Product Hunt"');
    console.log("  bun run index.ts --agents");
    console.log("  bun run index.ts --strategies");
    console.log("  bun run index.ts --config");
    return;
  }

  console.log(`📝 Request: "${request}"\n`);
  const msg = createMessage("cli", "orchestrator", "task", { action: "orchestrate", input: { request } });
  const result = await bus.send(msg);

  if (result.type === "error") {
    console.error("❌ Error:", result.payload.message);
    process.exit(1);
  }

  console.log("\n📋 Result:");
  console.log(JSON.stringify(result.payload, null, 2));
}

main().catch(console.error);
