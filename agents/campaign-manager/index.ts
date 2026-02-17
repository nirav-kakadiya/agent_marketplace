// Campaign Manager Agent — orchestrates multi-step, multi-agent campaigns
// This is what makes it an AGENT, not just a tool.

import { BaseAgent } from "../../core/agent";
import { createMessage, type Message, type TaskPayload, type ResultPayload } from "../../core/message";
import { MessageBus } from "../../core/bus";
import { LLM, type LLMMessage } from "../../core/llm";
import type { Memory } from "../../core/memory";
import type { Campaign, CampaignStep, CampaignLog, CampaignStrategy, StepStatus } from "./types";
import { getStrategy, listStrategies, getStrategyNames } from "./strategies";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";

export class CampaignManagerAgent extends BaseAgent {
  private llm: LLM;
  private bus: MessageBus;
  private memory: Memory;
  private campaigns: Map<string, Campaign> = new Map();
  private dataDir: string;
  private onProgress?: (campaign: Campaign, log: CampaignLog) => void;

  constructor(llm: LLM, bus: MessageBus, memory: Memory, dataDir: string) {
    super({
      name: "campaign-manager",
      description: "Creates and executes multi-step marketing campaigns — product launches, content marketing, social blitz",
      version: "1.0.0",
      capabilities: [
        {
          name: "create-campaign",
          description: "Create a new marketing campaign",
          inputSchema: { request: "string", strategy: "string?", platforms: "string[]?" },
          outputSchema: { campaign: "object" },
        },
        {
          name: "run-campaign",
          description: "Execute a campaign step by step",
          inputSchema: { campaignId: "string" },
          outputSchema: { campaign: "object" },
        },
        {
          name: "campaign-status",
          description: "Get campaign status and progress",
          inputSchema: { campaignId: "string" },
          outputSchema: { campaign: "object" },
        },
        {
          name: "list-campaigns",
          description: "List all campaigns",
          inputSchema: {},
          outputSchema: { campaigns: "object[]" },
        },
        {
          name: "pause-campaign",
          description: "Pause a running campaign",
          inputSchema: { campaignId: "string" },
          outputSchema: { success: "boolean" },
        },
        {
          name: "list-strategies",
          description: "List available campaign strategies",
          inputSchema: {},
          outputSchema: { strategies: "object[]" },
        },
      ],
    });
    this.llm = llm;
    this.bus = bus;
    this.memory = memory;
    this.dataDir = dataDir;
  }

  setProgressCallback(cb: (campaign: Campaign, log: CampaignLog) => void) {
    this.onProgress = cb;
  }

  async init() {
    await mkdir(this.dataDir, { recursive: true });
    await this.loadCampaigns();
  }

  async handle(message: Message): Promise<Message> {
    const task = message.payload as TaskPayload;

    try {
      let output: any;

      switch (task.action) {
        case "create-campaign":
          output = await this.createCampaign(task.input);
          break;
        case "run-campaign":
          output = await this.runCampaign(task.input.campaignId);
          break;
        case "campaign-status":
          output = this.getCampaign(task.input.campaignId);
          break;
        case "list-campaigns":
          output = { campaigns: Array.from(this.campaigns.values()).map(this.summarize) };
          break;
        case "pause-campaign":
          output = this.pauseCampaign(task.input.campaignId);
          break;
        case "list-strategies":
          output = { strategies: listStrategies() };
          break;
        default:
          // Smart routing: if it looks like a campaign request, create one
          output = await this.createCampaign(task.input);
      }

      return createMessage(this.name, message.from, "result", {
        success: true,
        output,
      } satisfies ResultPayload, message.id);
    } catch (err: any) {
      return createMessage(this.name, message.from, "error", {
        code: "CAMPAIGN_ERROR",
        message: err.message,
        retryable: true,
      }, message.id);
    }
  }

  // === Campaign Creation ===

  private async createCampaign(input: any): Promise<Campaign> {
    const request = input.request || input.topic || JSON.stringify(input);

    // 1. Determine strategy (LLM picks if not specified)
    const strategy = input.strategy
      ? (input.strategy as CampaignStrategy)
      : await this.detectStrategy(request);

    const template = getStrategy(strategy);
    if (!template) {
      throw new Error(`Unknown strategy: ${strategy}. Available: ${getStrategyNames().join(", ")}`);
    }

    // 2. Build campaign from template
    const campaignId = `camp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();

    const steps: CampaignStep[] = template.defaultSteps.map((s, i) => ({
      ...s,
      id: `step_${i + 1}`,
      status: "pending" as StepStatus,
      input: this.mergeStepInput(s, input, request),
      dependsOn: s.dependsOn || [],
    }));

    const campaign: Campaign = {
      id: campaignId,
      name: `${template.name}: ${request.slice(0, 50)}`,
      strategy,
      status: "planning",
      request,
      plan: {
        steps,
        timeline: template.estimatedDuration,
        kpis: this.getDefaultKPIs(strategy),
        estimatedDuration: template.estimatedDuration,
      },
      currentStep: 0,
      results: [],
      platforms: input.platforms || ["local-file"],
      tenantId: input.tenantId,
      startDate: now,
      createdAt: now,
      updatedAt: now,
      progress: 0,
      logs: [],
    };

    this.log(campaign, "info", `Campaign created: ${campaign.name}`);
    this.log(campaign, "info", `Strategy: ${strategy} | Steps: ${steps.length} | Est: ${template.estimatedDuration}`);

    this.campaigns.set(campaignId, campaign);
    await this.saveCampaigns();

    return campaign;
  }

  // === Campaign Execution ===

  async runCampaign(campaignId: string): Promise<Campaign> {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) throw new Error(`Campaign not found: ${campaignId}`);
    if (campaign.status === "completed") throw new Error("Campaign already completed");
    if (campaign.status === "failed") throw new Error("Campaign failed. Create a new one.");

    campaign.status = "active";
    this.log(campaign, "info", "🚀 Campaign execution started");

    const steps = campaign.plan.steps;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      // Check if paused
      if (campaign.status === "paused") {
        this.log(campaign, "info", "⏸️ Campaign paused");
        break;
      }

      // Check dependencies
      if (!this.dependenciesMet(step, steps)) {
        this.log(campaign, "warn", `Skipping ${step.name} — dependencies not met`);
        step.status = "skipped";
        continue;
      }

      // Execute step
      campaign.currentStep = i;
      step.status = "running";
      step.startedAt = new Date().toISOString();
      this.log(campaign, "info", `▶️ Step ${i + 1}/${steps.length}: ${step.name}`);
      this.updateProgress(campaign);

      try {
        // Build input from previous step outputs
        const enrichedInput = this.enrichStepInput(step, steps);

        // Send to agent via bus
        const msg = createMessage("campaign-manager", step.agent, "task", {
          action: step.action,
          input: enrichedInput,
        });

        const result = await this.bus.send(msg);

        if (result.type === "error") {
          throw new Error(result.payload.message || "Agent returned error");
        }

        step.status = "done";
        step.output = result.payload.output || result.payload;
        step.completedAt = new Date().toISOString();

        const duration = new Date(step.completedAt).getTime() - new Date(step.startedAt!).getTime();
        campaign.results.push({
          stepId: step.id,
          stepName: step.name,
          agent: step.agent,
          status: "done",
          output: step.output,
          duration,
          timestamp: step.completedAt,
        });

        this.log(campaign, "success", `✅ ${step.name} completed (${Math.round(duration / 1000)}s)`);
      } catch (err: any) {
        step.status = "failed";
        step.error = err.message;
        step.completedAt = new Date().toISOString();

        this.log(campaign, "error", `❌ ${step.name} failed: ${err.message}`);

        campaign.results.push({
          stepId: step.id,
          stepName: step.name,
          agent: step.agent,
          status: "failed",
          output: { error: err.message },
          duration: 0,
          timestamp: new Date().toISOString(),
        });

        // Continue with other steps that don't depend on this one
      }

      this.updateProgress(campaign);
      await this.saveCampaigns();
    }

    // Determine final status
    const allDone = steps.every((s) => s.status === "done" || s.status === "skipped");
    const anyFailed = steps.some((s) => s.status === "failed");

    if (allDone) {
      campaign.status = "completed";
      this.log(campaign, "success", "🎉 Campaign completed successfully!");
    } else if (anyFailed && !steps.some((s) => s.status === "pending")) {
      campaign.status = "completed";
      this.log(campaign, "warn", "⚠️ Campaign completed with some failures");
    }

    campaign.endDate = new Date().toISOString();
    campaign.updatedAt = new Date().toISOString();
    await this.saveCampaigns();

    return campaign;
  }

  // === Helpers ===

  private async detectStrategy(request: string): Promise<CampaignStrategy> {
    const strategies = getStrategyNames();
    const messages: LLMMessage[] = [
      {
        role: "system",
        content: `You are a marketing strategist. Given a request, pick the best campaign strategy. Reply with ONLY the strategy name, nothing else.`,
      },
      {
        role: "user",
        content: `Request: "${request}"\n\nAvailable strategies: ${strategies.join(", ")}\n\nPick one:`,
      },
    ];

    const response = await this.llm.chat(messages);
    const picked = response.content.trim().toLowerCase().replace(/[^a-z-]/g, "") as CampaignStrategy;
    return strategies.includes(picked) ? picked : "content-marketing";
  }

  private mergeStepInput(step: any, userInput: any, request: string): Record<string, any> {
    return {
      ...step.input,
      topic: userInput.topic || request,
      productName: userInput.productName,
      productUrl: userInput.productUrl,
      brandGuidelines: userInput.brandGuidelines,
    };
  }

  private enrichStepInput(step: CampaignStep, allSteps: CampaignStep[]): Record<string, any> {
    const input = { ...step.input };

    // Feed outputs from dependency steps into this step's input
    for (const depId of step.dependsOn) {
      const depStep = allSteps.find((s) => s.id === depId);
      if (depStep?.output) {
        // Pass research findings to writer
        if (depStep.agent === "researcher" && step.agent === "writer") {
          input.research = depStep.output.findings || depStep.output;
        }
        // Pass written content to editor
        if (depStep.agent === "writer" && step.agent === "editor") {
          input.content = depStep.output.content || JSON.stringify(depStep.output);
          if (depStep.output.metadata?.primaryKeyword) {
            input.keywords = [depStep.output.metadata.primaryKeyword];
          }
        }
        // Pass edited content to brand-manager
        if (depStep.agent === "editor" && step.agent === "brand-manager") {
          input.content = depStep.output.editedContent || depStep.output.optimizedContent || JSON.stringify(depStep.output);
        }
        // Pass content to social-writer
        if ((depStep.agent === "writer" || depStep.agent === "editor") && step.agent === "social-writer") {
          input.content = depStep.output.content || depStep.output.editedContent || JSON.stringify(depStep.output);
          input.title = depStep.output.title;
        }
        // Pass everything to publisher
        if (step.agent === "publisher") {
          if (depStep.output.content || depStep.output.editedContent) {
            input.content = depStep.output.editedContent || depStep.output.content;
            input.title = depStep.output.title;
          }
          if (depStep.agent === "social-writer") {
            input.socialPosts = depStep.output;
          }
        }
      }
    }

    return input;
  }

  private dependenciesMet(step: CampaignStep, allSteps: CampaignStep[]): boolean {
    if (!step.dependsOn.length) return true;
    return step.dependsOn.every((depId) => {
      const dep = allSteps.find((s) => s.id === depId);
      return dep?.status === "done";
    });
  }

  private updateProgress(campaign: Campaign) {
    const total = campaign.plan.steps.length;
    const done = campaign.plan.steps.filter((s) => s.status === "done" || s.status === "skipped").length;
    campaign.progress = Math.round((done / total) * 100);
  }

  private log(campaign: Campaign, level: CampaignLog["level"], message: string) {
    const log: CampaignLog = { timestamp: new Date().toISOString(), level, message };
    campaign.logs.push(log);
    if (this.onProgress) this.onProgress(campaign, log);
    console.log(`[Campaign ${campaign.id}] ${message}`);
  }

  private getDefaultKPIs(strategy: CampaignStrategy): string[] {
    const kpis: Record<CampaignStrategy, string[]> = {
      "product-launch": ["launch day traffic", "signups", "social mentions", "press coverage"],
      "content-marketing": ["organic traffic", "keyword rankings", "time on page", "conversions"],
      "social-blitz": ["impressions", "engagement rate", "followers gained", "click-through rate"],
      "email-nurture": ["open rate", "click rate", "conversion rate", "unsubscribe rate"],
      "seo-domination": ["keyword rankings", "organic traffic", "backlinks", "domain authority"],
      "competitor-counter": ["market share", "brand mentions", "feature adoption"],
    };
    return kpis[strategy] || [];
  }

  private summarize(c: Campaign) {
    return {
      id: c.id,
      name: c.name,
      strategy: c.strategy,
      status: c.status,
      progress: c.progress,
      steps: c.plan.steps.length,
      createdAt: c.createdAt,
    };
  }

  private getCampaign(id: string): Campaign {
    const c = this.campaigns.get(id);
    if (!c) throw new Error(`Campaign not found: ${id}`);
    return c;
  }

  private pauseCampaign(id: string): { success: boolean } {
    const c = this.campaigns.get(id);
    if (!c) throw new Error(`Campaign not found: ${id}`);
    c.status = "paused";
    return { success: true };
  }

  // === Persistence ===

  private async loadCampaigns() {
    try {
      const data = await readFile(join(this.dataDir, "campaigns.json"), "utf-8");
      const list: Campaign[] = JSON.parse(data);
      for (const c of list) this.campaigns.set(c.id, c);
      console.log(`📋 Campaigns: ${this.campaigns.size} loaded`);
    } catch {
      console.log("📋 Campaigns: starting fresh");
    }
  }

  private async saveCampaigns() {
    await writeFile(
      join(this.dataDir, "campaigns.json"),
      JSON.stringify(Array.from(this.campaigns.values()), null, 2),
    );
  }
}
