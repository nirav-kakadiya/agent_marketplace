// Agent Marketplace — Marketing Agent
// Multi-agent system with campaign orchestration
// Run: bun run index.ts "your request"

import { join } from "path";
import { MessageBus } from "./core/bus";
import { Memory } from "./core/memory";
import { LLM } from "./core/llm";
import { createMessage } from "./core/message";
import type { SearchConfig } from "./agents/researcher/tools/web-search";

// Agents
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
  console.log("🚀 Agent Marketplace — Marketing Agent");
  console.log("━".repeat(45));

  // --- Config ---
  const apiKey = process.env.LLM_API_KEY || process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || "";
  const provider = process.env.LLM_PROVIDER || (process.env.OPENROUTER_API_KEY ? "openrouter" : process.env.ANTHROPIC_API_KEY ? "anthropic" : "openai");
  const model = process.env.LLM_MODEL || undefined;
  const baseUrl = process.env.LLM_BASE_URL || undefined;

  if (!apiKey) {
    console.error("❌ Set LLM_API_KEY (or OPENROUTER_API_KEY / ANTHROPIC_API_KEY / OPENAI_API_KEY)");
    process.exit(1);
  }

  const searchConfig: SearchConfig = {
    provider: (process.env.SEARCH_PROVIDER as any) || "brave",
    apiKey: process.env.SEARCH_API_KEY || "",
  };

  if (!searchConfig.apiKey) {
    console.warn("⚠️  No SEARCH_API_KEY set — researcher will have limited capabilities");
  }

  // --- Initialize core ---
  const llm = new LLM({ provider, apiKey, model, baseUrl });
  const memory = new Memory(join(ROOT, "memory"));
  const bus = new MessageBus();
  await memory.init();

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

  // Load platform credentials
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

  console.log(`\n✅ ${bus.listAgentNames().length} agents ready: ${bus.listAgentNames().join(", ")}\n`);

  // --- Handle CLI args ---
  const args = process.argv.slice(2);

  if (args.includes("--agents")) {
    console.log(bus.describeAll());
    return;
  }

  if (args.includes("--strategies")) {
    const msg = createMessage("cli", "campaign-manager", "task", {
      action: "list-strategies",
      input: {},
    });
    const result = await bus.send(msg);
    console.log(JSON.stringify(result.payload, null, 2));
    return;
  }

  if (args.includes("--campaigns")) {
    const msg = createMessage("cli", "campaign-manager", "task", {
      action: "list-campaigns",
      input: {},
    });
    const result = await bus.send(msg);
    console.log(JSON.stringify(result.payload, null, 2));
    return;
  }

  const request = args.filter((a) => !a.startsWith("--")).join(" ");
  if (!request) {
    console.log("Usage:");
    console.log('  bun run index.ts "Write a blog about AI trends"');
    console.log('  bun run index.ts "Launch my SaaS on Product Hunt"');
    console.log("  bun run index.ts --agents");
    console.log("  bun run index.ts --strategies");
    console.log("  bun run index.ts --campaigns");
    return;
  }

  // --- Run request through orchestrator ---
  console.log(`📝 Request: "${request}"\n`);

  const msg = createMessage("cli", "orchestrator", "task", {
    action: "orchestrate",
    input: { request },
  });

  const result = await bus.send(msg);

  if (result.type === "error") {
    console.error("❌ Error:", result.payload.message);
    process.exit(1);
  }

  console.log("\n📋 Result:");
  console.log(JSON.stringify(result.payload, null, 2));
}

main().catch(console.error);
