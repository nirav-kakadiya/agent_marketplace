// LLM — Vendor-agnostic interface with provider adapters
// Switch providers via config/env. Zero code changes needed.

// ─── THE INTERFACE (never changes) ───────────────────────

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  provider: string;
  usage?: { inputTokens: number; outputTokens: number };
}

export interface LLMConfig {
  provider: string;    // "openrouter" | "anthropic" | "openai" | "gemini" | etc.
  apiKey: string;
  model?: string;
  baseUrl?: string;    // override API endpoint
  maxTokens?: number;
  temperature?: number;
}

// ─── PROVIDER ADAPTER INTERFACE ──────────────────────────
// To add a new provider: implement this interface. That's it.

export interface LLMProvider {
  name: string;
  chat(messages: LLMMessage[], config: LLMConfig): Promise<LLMResponse>;
}

// ─── PROVIDER REGISTRY ───────────────────────────────────
// Providers register themselves. The LLM class just routes.

const providers: Map<string, LLMProvider> = new Map();

export function registerProvider(provider: LLMProvider) {
  providers.set(provider.name, provider);
}

export function listProviders(): string[] {
  return Array.from(providers.keys());
}

// ─── OPENROUTER ADAPTER ─────────────────────────────────

const openRouterProvider: LLMProvider = {
  name: "openrouter",
  async chat(messages: LLMMessage[], config: LLMConfig): Promise<LLMResponse> {
    const baseUrl = config.baseUrl || "https://openrouter.ai/api/v1";
    const model = config.model || "anthropic/claude-sonnet-4";

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`,
        "HTTP-Referer": "https://github.com/nirav-kakadiya/agent",
        "X-Title": "ARISE Agent System",
      },
      body: JSON.stringify({
        model,
        max_tokens: config.maxTokens || 4096,
        temperature: config.temperature,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    const data: any = await res.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));

    return {
      content: data.choices[0].message.content,
      model: data.model || model,
      provider: "openrouter",
      usage: {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
      },
    };
  },
};

// ─── ANTHROPIC ADAPTER ──────────────────────────────────

const anthropicProvider: LLMProvider = {
  name: "anthropic",
  async chat(messages: LLMMessage[], config: LLMConfig): Promise<LLMResponse> {
    const baseUrl = config.baseUrl || "https://api.anthropic.com";
    const model = config.model || "claude-sonnet-4-20250514";

    const systemMsg = messages.find((m) => m.role === "system")?.content || "";
    const chatMessages = messages.filter((m) => m.role !== "system");

    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: config.maxTokens || 4096,
        temperature: config.temperature,
        system: systemMsg,
        messages: chatMessages,
      }),
    });

    const data: any = await res.json();
    if (data.error) throw new Error(data.error.message);

    return {
      content: data.content[0].text,
      model: data.model || model,
      provider: "anthropic",
      usage: {
        inputTokens: data.usage?.input_tokens || 0,
        outputTokens: data.usage?.output_tokens || 0,
      },
    };
  },
};

// ─── OPENAI ADAPTER ─────────────────────────────────────

const openAIProvider: LLMProvider = {
  name: "openai",
  async chat(messages: LLMMessage[], config: LLMConfig): Promise<LLMResponse> {
    const baseUrl = config.baseUrl || "https://api.openai.com/v1";
    const model = config.model || "gpt-4o";

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: config.maxTokens || 4096,
        temperature: config.temperature,
        messages,
      }),
    });

    const data: any = await res.json();
    if (data.error) throw new Error(data.error.message);

    return {
      content: data.choices[0].message.content,
      model: data.model || model,
      provider: "openai",
      usage: {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
      },
    };
  },
};

// ─── GEMINI ADAPTER ─────────────────────────────────────

const geminiProvider: LLMProvider = {
  name: "gemini",
  async chat(messages: LLMMessage[], config: LLMConfig): Promise<LLMResponse> {
    const model = config.model || "gemini-2.0-flash";
    const baseUrl = config.baseUrl || "https://generativelanguage.googleapis.com/v1beta";

    // Convert messages to Gemini format
    const systemInstruction = messages.find((m) => m.role === "system")?.content;
    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    const body: any = { contents };
    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }
    body.generationConfig = {
      maxOutputTokens: config.maxTokens || 4096,
      temperature: config.temperature,
    };

    const res = await fetch(
      `${baseUrl}/models/${model}:generateContent?key=${config.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const data: any = await res.json();
    if (data.error) throw new Error(data.error.message);

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return {
      content: text,
      model,
      provider: "gemini",
      usage: {
        inputTokens: data.usageMetadata?.promptTokenCount || 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
      },
    };
  },
};

// ─── REGISTER ALL BUILT-IN PROVIDERS ─────────────────────

registerProvider(openRouterProvider);
registerProvider(anthropicProvider);
registerProvider(openAIProvider);
registerProvider(geminiProvider);

// ─── THE LLM CLASS (router) ─────────────────────────────
// This just routes to the right provider. Clean and simple.

export class LLM {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;

    const provider = providers.get(config.provider);
    if (!provider) {
      throw new Error(
        `Unknown LLM provider: "${config.provider}". Available: ${listProviders().join(", ")}`
      );
    }

    console.log(`🤖 LLM: ${config.provider} / ${config.model || "default"}`);
  }

  async chat(messages: LLMMessage[]): Promise<LLMResponse> {
    const provider = providers.get(this.config.provider)!;
    return provider.chat(messages, this.config);
  }

  // Switch provider at runtime (no restart needed)
  switchProvider(provider: string, model?: string) {
    if (!providers.has(provider)) {
      throw new Error(`Unknown provider: ${provider}. Available: ${listProviders().join(", ")}`);
    }
    this.config.provider = provider;
    if (model) this.config.model = model;
    console.log(`🔄 LLM switched to: ${provider} / ${model || this.config.model}`);
  }

  // Get current config
  getConfig(): Readonly<LLMConfig> {
    return { ...this.config };
  }
}
