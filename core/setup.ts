// Setup — guides users through configuration
// Checks what's configured, what's missing, and tells users how to fix it

import type { AgentConfig } from "./config";

export interface SetupCheck {
  name: string;
  key: string;
  status: "configured" | "missing" | "optional";
  required: boolean;
  description: string;
  howToGet: string;
  envVar: string;
}

export interface SetupResult {
  ready: boolean;
  configured: SetupCheck[];
  missing: SetupCheck[];
  optional: SetupCheck[];
  message: string;
}

// Check what's configured and what's missing
export function checkSetup(config: AgentConfig): SetupResult {
  const checks: SetupCheck[] = [
    // === Required ===
    {
      name: "LLM API Key",
      key: "llm",
      status: (config.server.llmApiKey || config.user.llmApiKey) ? "configured" : "missing",
      required: true,
      description: "Powers all AI thinking, writing, and analysis",
      howToGet: `Choose one:
  • OpenRouter (recommended, multiple models): https://openrouter.ai/keys
  • Anthropic (Claude): https://console.anthropic.com/settings/keys
  • OpenAI (GPT): https://platform.openai.com/api-keys
  • Google (Gemini): https://aistudio.google.com/apikey

Set in .env:
  LLM_API_KEY=your-key-here
  LLM_PROVIDER=openrouter  (or anthropic/openai/gemini)`,
      envVar: "LLM_API_KEY",
    },

    // === Recommended ===
    {
      name: "Search API Key",
      key: "search",
      status: (config.server.searchApiKey || config.user.searchApiKey) ? "configured" : "optional",
      required: false,
      description: "Enables real web research, competitor analysis, and trend finding",
      howToGet: `Choose one:
  • Brave Search (recommended, 2000 free/mo): https://brave.com/search/api/
  • Serper (2500 free): https://serper.dev
  • Google Custom Search: https://programmablesearchengine.google.com

Set in .env:
  SEARCH_API_KEY=your-key-here
  SEARCH_PROVIDER=brave  (or serper/google)`,
      envVar: "SEARCH_API_KEY",
    },

    // === Publishing (all optional) ===
    {
      name: "WordPress",
      key: "wordpress",
      status: config.platforms.wordpress ? "configured" : "optional",
      required: false,
      description: "Auto-publish blog posts to WordPress",
      howToGet: `1. Go to your WordPress dashboard
2. Users → Profile → Application Passwords
3. Create a new application password

Set in .env:
  WORDPRESS_URL=https://yoursite.com
  WORDPRESS_USERNAME=admin
  WORDPRESS_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx`,
      envVar: "WORDPRESS_URL",
    },
    {
      name: "Twitter/X",
      key: "twitter",
      status: config.platforms.twitter ? "configured" : "optional",
      required: false,
      description: "Auto-post to Twitter/X",
      howToGet: `1. Go to https://developer.twitter.com/en/portal/dashboard
2. Create a project and app
3. Generate API keys (Consumer + Access tokens)

Set in .env:
  TWITTER_BEARER_TOKEN=your-bearer-token
  TWITTER_ACCESS_TOKEN=your-access-token
  TWITTER_ACCESS_SECRET=your-access-secret`,
      envVar: "TWITTER_BEARER_TOKEN",
    },
    {
      name: "LinkedIn",
      key: "linkedin",
      status: config.platforms.linkedin ? "configured" : "optional",
      required: false,
      description: "Auto-post to LinkedIn",
      howToGet: `1. Go to https://www.linkedin.com/developers/apps
2. Create an app
3. Get OAuth 2.0 access token

Set in .env:
  LINKEDIN_ACCESS_TOKEN=your-oauth2-token
  LINKEDIN_PERSON_ID=your-person-id`,
      envVar: "LINKEDIN_ACCESS_TOKEN",
    },
    {
      name: "Medium",
      key: "medium",
      status: config.platforms.medium ? "configured" : "optional",
      required: false,
      description: "Auto-publish to Medium",
      howToGet: `1. Go to Medium → Settings → Security and apps → Integration tokens
2. Create a new token

Set in .env:
  MEDIUM_TOKEN=your-integration-token`,
      envVar: "MEDIUM_TOKEN",
    },
    {
      name: "Dev.to",
      key: "devto",
      status: config.platforms.devto ? "configured" : "optional",
      required: false,
      description: "Auto-publish to Dev.to",
      howToGet: `1. Go to https://dev.to/settings/extensions
2. Generate a new DEV API key

Set in .env:
  DEVTO_API_KEY=your-api-key`,
      envVar: "DEVTO_API_KEY",
    },
  ];

  const configured = checks.filter((c) => c.status === "configured");
  const missing = checks.filter((c) => c.status === "missing" && c.required);
  const optional = checks.filter((c) => c.status === "optional" || (c.status === "missing" && !c.required));

  const ready = missing.length === 0;

  let message = "";
  if (ready) {
    message = `✅ Agent is ready! ${configured.length} services configured.\n`;
    if (optional.length > 0) {
      message += `\n💡 Optional: Configure these for more features:\n`;
      message += optional.map((o) => `  • ${o.name} — ${o.description}`).join("\n");
    }
  } else {
    message = `⚠️ Setup needed! Missing ${missing.length} required configuration:\n\n`;
    message += missing.map((m) => `❌ ${m.name}\n   ${m.description}\n\n   How to get it:\n   ${m.howToGet}`).join("\n\n");
    message += `\n\nAfter adding to your .env file, restart OpenClaw.`;
  }

  return { ready, configured, missing, optional, message };
}

// Format setup status for chat display
export function formatSetupStatus(result: SetupResult): string {
  let output = "## 🔧 Agent Marketplace — Setup Status\n\n";

  if (result.ready) {
    output += "✅ **Ready to use!**\n\n";
  } else {
    output += "⚠️ **Setup needed**\n\n";
  }

  // Configured
  if (result.configured.length > 0) {
    output += "### ✅ Configured\n";
    result.configured.forEach((c) => {
      output += `- **${c.name}** — ${c.description}\n`;
    });
    output += "\n";
  }

  // Missing (required)
  if (result.missing.length > 0) {
    output += "### ❌ Required (must configure)\n";
    result.missing.forEach((m) => {
      output += `\n**${m.name}** — ${m.description}\n`;
      output += `\`\`\`\n${m.howToGet}\n\`\`\`\n`;
    });
    output += "\n";
  }

  // Optional
  if (result.optional.length > 0) {
    output += "### 💡 Optional (configure for more features)\n";
    result.optional.forEach((o) => {
      output += `- **${o.name}** — ${o.description}\n`;
    });
    output += "\n";
  }

  return output;
}

// Quick check: can this agent type work with current config?
export function canAgentWork(agentName: string, config: AgentConfig): { works: boolean; reason?: string } {
  const hasLLM = !!(config.server.llmApiKey || config.user.llmApiKey);
  const hasSearch = !!(config.server.searchApiKey || config.user.searchApiKey);

  if (!hasLLM) {
    return { works: false, reason: "No LLM API key configured. Set LLM_API_KEY in .env" };
  }

  // Agents that need search to be useful
  const needsSearch = ["researcher", "seo-agent", "sales-agent", "social-media-manager", "ecommerce-agent", "brand-design"];
  if (needsSearch.includes(agentName) && !hasSearch) {
    return { works: true, reason: `⚠️ ${agentName} works better with SEARCH_API_KEY configured (real web research). Currently using LLM-only mode.` };
  }

  return { works: true };
}
