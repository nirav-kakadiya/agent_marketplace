// Tenant Management — isolated per-user everything
// Each tenant gets their own memory, config, usage, and LLM context
// ZERO cross-contamination between tenants

import { readFile, writeFile, mkdir, readdir } from "fs/promises";
import { join } from "path";
import { randomBytes } from "crypto";

// ─── Types ───

export interface TenantPlan {
  name: "free" | "starter" | "pro" | "enterprise";
  limits: {
    requestsPerDay: number;
    requestsPerMonth: number;
    campaignsActive: number;
    memoryEntriesMax: number;
    agentsAllowed: string[]; // "*" = all, or specific agent names
  };
  features: {
    webSearch: boolean;
    publishing: boolean;
    campaigns: boolean;
    customInstructions: boolean;
    priorityQueue: boolean;
  };
}

export interface TenantUsage {
  today: { date: string; requests: number; tokens: number };
  month: { month: string; requests: number; tokens: number; cost: number };
  allTime: { requests: number; tokens: number; cost: number; firstRequest: string };
}

export interface TenantMemory {
  brand: {
    name?: string;
    url?: string;
    voice?: string;
    tone?: string;
    audience?: string;
    industry?: string;
    keywords?: string[];
    avoidWords?: string[];
    competitors?: string[];
    products?: string[];
    usp?: string; // unique selling proposition
  };
  preferences: {
    defaultTone?: string;
    defaultWordCount?: number;
    defaultPlatforms?: string[];
    preferredFormat?: string;
    language?: string;
    customInstructions?: string;
  };
  history: {
    pastTopics: string[];       // last 100
    pastOutputTypes: string[];  // what they've requested
    feedbackLog: Array<{ date: string; topic: string; rating: "good" | "bad"; note?: string }>;
  };
  platforms: {
    configured: string[];       // which platforms they've set up
    // NO credentials stored here — keys are in tenant config only
  };
  updatedAt: string;
}

export interface Tenant {
  id: string;
  apiKey: string;
  name: string;
  email?: string;
  plan: TenantPlan;
  usage: TenantUsage;
  memory: TenantMemory;
  config: {
    llmProvider?: string;
    llmModel?: string;
    // User's own keys (encrypted at rest in production)
    llmApiKey?: string;
    searchApiKey?: string;
    searchProvider?: string;
    platformKeys?: Record<string, string>;
  };
  createdAt: string;
  active: boolean;
}

// ─── Plans ───

export const PLANS: Record<string, TenantPlan> = {
  free: {
    name: "free",
    limits: { requestsPerDay: 10, requestsPerMonth: 100, campaignsActive: 1, memoryEntriesMax: 50, agentsAllowed: ["writer", "editor", "content-repurposer", "email-marketing"] },
    features: { webSearch: false, publishing: false, campaigns: false, customInstructions: false, priorityQueue: false },
  },
  starter: {
    name: "starter",
    limits: { requestsPerDay: 50, requestsPerMonth: 1000, campaignsActive: 3, memoryEntriesMax: 200, agentsAllowed: ["*"] },
    features: { webSearch: true, publishing: true, campaigns: true, customInstructions: true, priorityQueue: false },
  },
  pro: {
    name: "pro",
    limits: { requestsPerDay: 500, requestsPerMonth: 10000, campaignsActive: 20, memoryEntriesMax: 1000, agentsAllowed: ["*"] },
    features: { webSearch: true, publishing: true, campaigns: true, customInstructions: true, priorityQueue: true },
  },
  enterprise: {
    name: "enterprise",
    limits: { requestsPerDay: -1, requestsPerMonth: -1, campaignsActive: -1, memoryEntriesMax: -1, agentsAllowed: ["*"] },
    features: { webSearch: true, publishing: true, campaigns: true, customInstructions: true, priorityQueue: true },
  },
};

// ─── Tenant Store ───

export class TenantStore {
  private dataDir: string;
  private tenants: Map<string, Tenant> = new Map();
  private keyIndex: Map<string, string> = new Map(); // apiKey → tenantId

  constructor(dataDir: string) {
    this.dataDir = join(dataDir, "tenants");
  }

  async init() {
    await mkdir(this.dataDir, { recursive: true });
    await this.loadAll();
    console.log(`👥 Tenants: ${this.tenants.size} loaded`);
  }

  // ─── CRUD ───

  async create(name: string, email?: string, planName: string = "free"): Promise<Tenant> {
    const id = `tenant_${randomBytes(12).toString("hex")}`;
    const apiKey = `mk_${randomBytes(24).toString("hex")}`;
    const plan = PLANS[planName] || PLANS.free;
    const now = new Date().toISOString();

    const tenant: Tenant = {
      id, apiKey, name, email, plan, active: true,
      createdAt: now,
      usage: {
        today: { date: now.slice(0, 10), requests: 0, tokens: 0 },
        month: { month: now.slice(0, 7), requests: 0, tokens: 0, cost: 0 },
        allTime: { requests: 0, tokens: 0, cost: 0, firstRequest: "" },
      },
      memory: {
        brand: {},
        preferences: {},
        history: { pastTopics: [], pastOutputTypes: [], feedbackLog: [] },
        platforms: { configured: [] },
        updatedAt: now,
      },
      config: {},
    };

    this.tenants.set(id, tenant);
    this.keyIndex.set(apiKey, id);
    await this.saveTenant(tenant);
    return tenant;
  }

  getById(id: string): Tenant | undefined {
    return this.tenants.get(id);
  }

  getByApiKey(apiKey: string): Tenant | undefined {
    const id = this.keyIndex.get(apiKey);
    return id ? this.tenants.get(id) : undefined;
  }

  async update(id: string, updates: Partial<Tenant>): Promise<Tenant | undefined> {
    const tenant = this.tenants.get(id);
    if (!tenant) return undefined;
    Object.assign(tenant, updates);
    await this.saveTenant(tenant);
    return tenant;
  }

  list(): Tenant[] {
    return Array.from(this.tenants.values());
  }

  // ─── MEMORY (per-tenant, completely isolated) ───

  getMemory(tenantId: string): TenantMemory | undefined {
    return this.tenants.get(tenantId)?.memory;
  }

  async updateMemory(tenantId: string, updates: Partial<TenantMemory>): Promise<void> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) return;

    // Deep merge brand
    if (updates.brand) {
      tenant.memory.brand = { ...tenant.memory.brand, ...updates.brand };
    }
    // Deep merge preferences
    if (updates.preferences) {
      tenant.memory.preferences = { ...tenant.memory.preferences, ...updates.preferences };
    }
    // Append history (with limits)
    if (updates.history) {
      if (updates.history.pastTopics?.length) {
        tenant.memory.history.pastTopics = [
          ...tenant.memory.history.pastTopics,
          ...updates.history.pastTopics,
        ].slice(-100); // keep last 100
      }
      if (updates.history.pastOutputTypes?.length) {
        tenant.memory.history.pastOutputTypes = [
          ...new Set([...tenant.memory.history.pastOutputTypes, ...updates.history.pastOutputTypes]),
        ];
      }
      if (updates.history.feedbackLog?.length) {
        const maxFeedback = tenant.plan.limits.memoryEntriesMax > 0 ? tenant.plan.limits.memoryEntriesMax : 10000;
        tenant.memory.history.feedbackLog = [
          ...tenant.memory.history.feedbackLog,
          ...updates.history.feedbackLog,
        ].slice(-maxFeedback);
      }
    }
    if (updates.platforms) {
      tenant.memory.platforms.configured = [
        ...new Set([...tenant.memory.platforms.configured, ...updates.platforms.configured]),
      ];
    }

    tenant.memory.updatedAt = new Date().toISOString();
    await this.saveTenant(tenant);
  }

  // Build LLM context string for a specific tenant — ONLY their data
  getTenantContext(tenantId: string): string {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) return "";

    const m = tenant.memory;
    let ctx = "";

    // Brand context
    if (m.brand.name || m.brand.url || m.brand.industry) {
      ctx += "## User's Brand\n";
      if (m.brand.name) ctx += `- Name: ${m.brand.name}\n`;
      if (m.brand.url) ctx += `- Website: ${m.brand.url}\n`;
      if (m.brand.industry) ctx += `- Industry: ${m.brand.industry}\n`;
      if (m.brand.audience) ctx += `- Target audience: ${m.brand.audience}\n`;
      if (m.brand.voice) ctx += `- Brand voice: ${m.brand.voice}\n`;
      if (m.brand.tone) ctx += `- Tone: ${m.brand.tone}\n`;
      if (m.brand.usp) ctx += `- USP: ${m.brand.usp}\n`;
      if (m.brand.products?.length) ctx += `- Products: ${m.brand.products.join(", ")}\n`;
      if (m.brand.keywords?.length) ctx += `- Focus keywords: ${m.brand.keywords.join(", ")}\n`;
      if (m.brand.avoidWords?.length) ctx += `- Words to avoid: ${m.brand.avoidWords.join(", ")}\n`;
      if (m.brand.competitors?.length) ctx += `- Known competitors: ${m.brand.competitors.join(", ")}\n`;
      ctx += "\n";
    }

    // Preferences
    if (m.preferences.customInstructions || m.preferences.defaultTone) {
      ctx += "## User Preferences\n";
      if (m.preferences.customInstructions) ctx += `- Custom instructions: ${m.preferences.customInstructions}\n`;
      if (m.preferences.defaultTone) ctx += `- Preferred tone: ${m.preferences.defaultTone}\n`;
      if (m.preferences.language) ctx += `- Language: ${m.preferences.language}\n`;
      if (m.preferences.defaultPlatforms?.length) ctx += `- Platforms: ${m.preferences.defaultPlatforms.join(", ")}\n`;
      ctx += "\n";
    }

    // Recent topics (so we don't repeat)
    if (m.history.pastTopics.length > 0) {
      ctx += `## Recent Topics (avoid repeating)\n`;
      ctx += m.history.pastTopics.slice(-10).map(t => `- ${t}`).join("\n") + "\n\n";
    }

    return ctx;
  }

  // ─── USAGE TRACKING ───

  async trackUsage(tenantId: string, tokens: number = 0, cost: number = 0): Promise<{ allowed: boolean; reason?: string }> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) return { allowed: false, reason: "Tenant not found" };
    if (!tenant.active) return { allowed: false, reason: "Account disabled" };

    const today = new Date().toISOString().slice(0, 10);
    const month = today.slice(0, 7);

    // Reset daily counter if new day
    if (tenant.usage.today.date !== today) {
      tenant.usage.today = { date: today, requests: 0, tokens: 0 };
    }
    // Reset monthly counter if new month
    if (tenant.usage.month.month !== month) {
      tenant.usage.month = { month, requests: 0, tokens: 0, cost: 0 };
    }

    // Check limits (-1 = unlimited)
    const limits = tenant.plan.limits;
    if (limits.requestsPerDay > 0 && tenant.usage.today.requests >= limits.requestsPerDay) {
      return { allowed: false, reason: `Daily limit reached (${limits.requestsPerDay}/day on ${tenant.plan.name} plan). Upgrade for more: https://marketplace.nextbase.solutions/pricing` };
    }
    if (limits.requestsPerMonth > 0 && tenant.usage.month.requests >= limits.requestsPerMonth) {
      return { allowed: false, reason: `Monthly limit reached (${limits.requestsPerMonth}/month on ${tenant.plan.name} plan). Upgrade for more: https://marketplace.nextbase.solutions/pricing` };
    }

    // Track
    tenant.usage.today.requests++;
    tenant.usage.today.tokens += tokens;
    tenant.usage.month.requests++;
    tenant.usage.month.tokens += tokens;
    tenant.usage.month.cost += cost;
    tenant.usage.allTime.requests++;
    tenant.usage.allTime.tokens += tokens;
    tenant.usage.allTime.cost += cost;
    if (!tenant.usage.allTime.firstRequest) tenant.usage.allTime.firstRequest = new Date().toISOString();

    await this.saveTenant(tenant);
    return { allowed: true };
  }

  // Check if tenant can use a specific agent
  canUseAgent(tenantId: string, agentName: string): { allowed: boolean; reason?: string } {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) return { allowed: false, reason: "Tenant not found" };

    const allowed = tenant.plan.limits.agentsAllowed;
    if (allowed.includes("*") || allowed.includes(agentName)) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: `Agent "${agentName}" is not available on the ${tenant.plan.name} plan. Available agents: ${allowed.join(", ")}. Upgrade for full access.`,
    };
  }

  // ─── Persistence (each tenant = separate file for isolation) ───

  private async saveTenant(tenant: Tenant) {
    const filePath = join(this.dataDir, `${tenant.id}.json`);
    await writeFile(filePath, JSON.stringify(tenant, null, 2));
  }

  private async loadAll() {
    try {
      const files = await readdir(this.dataDir);
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        try {
          const data = await readFile(join(this.dataDir, file), "utf-8");
          const tenant: Tenant = JSON.parse(data);
          this.tenants.set(tenant.id, tenant);
          this.keyIndex.set(tenant.apiKey, tenant.id);
        } catch { /* skip corrupted files */ }
      }
    } catch { /* dir doesn't exist yet */ }
  }
}
