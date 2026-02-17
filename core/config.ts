// Config — ONE place to control everything
// Change billing model, LLM provider, search provider — all from config
// Zero code changes needed to switch between models A, B, C

import { readFile } from "fs/promises";
import { join } from "path";

// === Billing Models ===
// "free"    → User's keys only, no server costs for you
// "saas"    → Your keys only, user pays subscription
// "hybrid"  → User can bring own keys OR use yours (fallback)
export type BillingModel = "free" | "saas" | "hybrid";

// === Execution Mode ===
// "local"   → Runs inside OpenClaw as a skill (no server needed)
// "remote"  → Runs on your server, OpenClaw calls API
// "both"    → Supports both (auto-detects)
export type ExecutionMode = "local" | "remote" | "both";

export interface AgentConfig {
  // === Business Model (change these to switch strategy) ===
  billing: BillingModel;
  execution: ExecutionMode;

  // === Your Keys (used in "saas" and "hybrid" fallback) ===
  server: {
    llmProvider: string;
    llmApiKey: string;
    llmModel: string;
    llmBaseUrl?: string;
    searchProvider: string;
    searchApiKey: string;
  };

  // === User Keys (passed from OpenClaw in "free" and "hybrid") ===
  user: {
    llmApiKey?: string;
    llmProvider?: string;
    llmModel?: string;
    searchApiKey?: string;
    searchProvider?: string;
  };

  // === Features (toggle on/off) ===
  features: {
    campaigns: boolean;        // multi-step campaigns
    seoTools: boolean;         // keyword research, SERP analysis
    socialWriter: boolean;     // social media post generation
    publishing: boolean;       // auto-publish to platforms
    analytics: boolean;        // performance tracking
    scheduling: boolean;       // recurring jobs
    brandManager: boolean;     // brand voice consistency
  };

  // === Limits (for billing/rate limiting) ===
  limits: {
    maxCampaignsPerMonth: number;    // -1 = unlimited
    maxGenerationsPerDay: number;    // -1 = unlimited
    maxTokensPerMonth: number;       // -1 = unlimited
  };

  // === Publishing platforms the user has configured ===
  platforms: Record<string, Record<string, string>>;

  // === Server config ===
  port: number;
  authEnabled: boolean;
}

// === Default config ===
const DEFAULT_CONFIG: AgentConfig = {
  billing: "hybrid",
  execution: "both",

  server: {
    llmProvider: "openrouter",
    llmApiKey: "",
    llmModel: "anthropic/claude-sonnet-4",
    searchProvider: "brave",
    searchApiKey: "",
  },

  user: {},

  features: {
    campaigns: true,
    seoTools: true,
    socialWriter: true,
    publishing: true,
    analytics: true,
    scheduling: true,
    brandManager: true,
  },

  limits: {
    maxCampaignsPerMonth: -1,
    maxGenerationsPerDay: -1,
    maxTokensPerMonth: -1,
  },

  platforms: {},

  port: 3000,
  authEnabled: false,
};

// === Load config from file + env ===
export async function loadConfig(configPath?: string): Promise<AgentConfig> {
  let fileConfig: Partial<AgentConfig> = {};

  // 1. Try loading from config file
  if (configPath) {
    try {
      const data = await readFile(configPath, "utf-8");
      fileConfig = JSON.parse(data);
    } catch {}
  }

  // 2. Merge: defaults → file → env
  const config: AgentConfig = {
    ...DEFAULT_CONFIG,
    ...fileConfig,
    server: { ...DEFAULT_CONFIG.server, ...fileConfig.server },
    user: { ...DEFAULT_CONFIG.user, ...fileConfig.user },
    features: { ...DEFAULT_CONFIG.features, ...fileConfig.features },
    limits: { ...DEFAULT_CONFIG.limits, ...fileConfig.limits },
    platforms: { ...DEFAULT_CONFIG.platforms, ...fileConfig.platforms },
  };

  // 3. Override from environment variables
  if (process.env.BILLING_MODEL) config.billing = process.env.BILLING_MODEL as BillingModel;
  if (process.env.EXECUTION_MODE) config.execution = process.env.EXECUTION_MODE as ExecutionMode;

  // Server keys (yours)
  if (process.env.LLM_API_KEY) config.server.llmApiKey = process.env.LLM_API_KEY;
  if (process.env.LLM_PROVIDER) config.server.llmProvider = process.env.LLM_PROVIDER;
  if (process.env.LLM_MODEL) config.server.llmModel = process.env.LLM_MODEL;
  if (process.env.LLM_BASE_URL) config.server.llmBaseUrl = process.env.LLM_BASE_URL;
  if (process.env.SEARCH_API_KEY) config.server.searchApiKey = process.env.SEARCH_API_KEY;
  if (process.env.SEARCH_PROVIDER) config.server.searchProvider = process.env.SEARCH_PROVIDER;

  // User keys (from OpenClaw)
  if (process.env.USER_LLM_API_KEY) config.user.llmApiKey = process.env.USER_LLM_API_KEY;
  if (process.env.USER_LLM_PROVIDER) config.user.llmProvider = process.env.USER_LLM_PROVIDER;
  if (process.env.USER_SEARCH_API_KEY) config.user.searchApiKey = process.env.USER_SEARCH_API_KEY;

  if (process.env.PORT) config.port = parseInt(process.env.PORT);
  if (process.env.AUTH_ENABLED) config.authEnabled = process.env.AUTH_ENABLED !== "false";

  // Platform credentials from env
  const prefixes = ["WORDPRESS_", "TWITTER_", "LINKEDIN_", "MEDIUM_", "DEVTO_"];
  for (const [key, value] of Object.entries(process.env)) {
    if (!value) continue;
    for (const prefix of prefixes) {
      if (key.startsWith(prefix)) {
        const platform = prefix.replace("_", "").toLowerCase();
        if (!config.platforms[platform]) config.platforms[platform] = {};
        config.platforms[platform][key] = value;
      }
    }
  }

  return config;
}

// === Resolve which keys to actually use ===
// This is where the magic happens — ONE function decides based on billing model
export function resolveKeys(config: AgentConfig): {
  llmProvider: string;
  llmApiKey: string;
  llmModel: string;
  llmBaseUrl?: string;
  searchProvider: string;
  searchApiKey: string;
  source: "user" | "server" | "hybrid";
} {
  switch (config.billing) {
    case "free":
      // User MUST provide keys
      if (!config.user.llmApiKey) {
        throw new Error("Free mode requires user to provide LLM_API_KEY");
      }
      return {
        llmProvider: config.user.llmProvider || config.server.llmProvider,
        llmApiKey: config.user.llmApiKey,
        llmModel: config.user.llmModel || config.server.llmModel,
        searchProvider: config.user.searchProvider || config.server.searchProvider,
        searchApiKey: config.user.searchApiKey || "",
        source: "user",
      };

    case "saas":
      // Always use server keys
      if (!config.server.llmApiKey) {
        throw new Error("SaaS mode requires server LLM_API_KEY");
      }
      return {
        llmProvider: config.server.llmProvider,
        llmApiKey: config.server.llmApiKey,
        llmModel: config.server.llmModel,
        llmBaseUrl: config.server.llmBaseUrl,
        searchProvider: config.server.searchProvider,
        searchApiKey: config.server.searchApiKey,
        source: "server",
      };

    case "hybrid":
    default:
      // User keys if available, fallback to server keys
      const hasUserLLM = !!config.user.llmApiKey;
      const hasServerLLM = !!config.server.llmApiKey;

      if (!hasUserLLM && !hasServerLLM) {
        throw new Error("No LLM API key available. Set LLM_API_KEY or USER_LLM_API_KEY");
      }

      return {
        llmProvider: hasUserLLM
          ? (config.user.llmProvider || config.server.llmProvider)
          : config.server.llmProvider,
        llmApiKey: hasUserLLM
          ? config.user.llmApiKey!
          : config.server.llmApiKey,
        llmModel: hasUserLLM
          ? (config.user.llmModel || config.server.llmModel)
          : config.server.llmModel,
        llmBaseUrl: hasUserLLM ? undefined : config.server.llmBaseUrl,
        searchProvider: config.user.searchProvider || config.server.searchProvider,
        searchApiKey: config.user.searchApiKey || config.server.searchApiKey,
        source: hasUserLLM ? "user" : (hasServerLLM ? "server" : "hybrid"),
      };
  }
}

// === Pretty print config (for logs, hide secrets) ===
export function printConfig(config: AgentConfig, keys: ReturnType<typeof resolveKeys>) {
  console.log("━".repeat(50));
  console.log("⚙️  Agent Marketplace — Configuration");
  console.log("━".repeat(50));
  console.log(`  Billing:    ${config.billing.toUpperCase()}`);
  console.log(`  Execution:  ${config.execution}`);
  console.log(`  LLM:        ${keys.llmProvider} / ${keys.llmModel}`);
  console.log(`  LLM Key:    ${keys.llmApiKey.slice(0, 8)}...${keys.llmApiKey.slice(-4)} (${keys.source})`);
  console.log(`  Search:     ${keys.searchProvider} ${keys.searchApiKey ? "✅" : "❌ (no key)"}`);
  console.log(`  Features:   ${Object.entries(config.features).filter(([,v]) => v).map(([k]) => k).join(", ")}`);

  const limits = config.limits;
  const limStr = [
    limits.maxCampaignsPerMonth === -1 ? "campaigns:∞" : `campaigns:${limits.maxCampaignsPerMonth}/mo`,
    limits.maxGenerationsPerDay === -1 ? "gen:∞" : `gen:${limits.maxGenerationsPerDay}/day`,
  ].join(", ");
  console.log(`  Limits:     ${limStr}`);
  console.log("━".repeat(50));
}
