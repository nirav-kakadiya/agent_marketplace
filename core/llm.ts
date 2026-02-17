// LLM — unified interface for AI models

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMResponse {
  content: string;
  usage?: { inputTokens: number; outputTokens: number };
}

export class LLM {
  private apiKey: string;
  private model: string;
  private provider: "openai" | "anthropic";

  constructor(provider: "openai" | "anthropic", apiKey: string, model?: string) {
    this.provider = provider;
    this.apiKey = apiKey;
    this.model = model || (provider === "anthropic" ? "claude-sonnet-4-20250514" : "gpt-4o");
  }

  async chat(messages: LLMMessage[]): Promise<LLMResponse> {
    if (this.provider === "anthropic") return this.chatAnthropic(messages);
    return this.chatOpenAI(messages);
  }

  private async chatAnthropic(messages: LLMMessage[]): Promise<LLMResponse> {
    const systemMsg = messages.find((m) => m.role === "system")?.content || "";
    const chatMessages = messages.filter((m) => m.role !== "system");

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 4096,
        system: systemMsg,
        messages: chatMessages,
      }),
    });

    const data: any = await res.json();
    if (data.error) throw new Error(data.error.message);
    return {
      content: data.content[0].text,
      usage: { inputTokens: data.usage?.input_tokens || 0, outputTokens: data.usage?.output_tokens || 0 },
    };
  }

  private async chatOpenAI(messages: LLMMessage[]): Promise<LLMResponse> {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: this.model, messages }),
    });

    const data: any = await res.json();
    if (data.error) throw new Error(data.error.message);
    return {
      content: data.choices[0].message.content,
      usage: { inputTokens: data.usage?.prompt_tokens || 0, outputTokens: data.usage?.completion_tokens || 0 },
    };
  }
}
