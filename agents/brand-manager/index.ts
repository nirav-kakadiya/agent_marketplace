// Brand Manager Agent — maintains brand voice consistency and learns from feedback

import { BaseAgent } from "../../core/agent";
import { createMessage, type Message, type TaskPayload, type ResultPayload } from "../../core/message";
import { LLM, type LLMMessage } from "../../core/llm";
import type { Memory } from "../../core/memory";

export interface BrandProfile {
  name: string;
  voice: string;
  tone: string;
  audience: string;
  industry: string;
  keywords: string[];
  avoidWords: string[];
  examples: string[];
  socialStyle: {
    twitter: string;
    linkedin: string;
    instagram: string;
  };
  learnings: string[];
}

export class BrandManagerAgent extends BaseAgent {
  private llm: LLM;
  private memory: Memory;

  constructor(llm: LLM, memory: Memory) {
    super({
      name: "brand-manager",
      description: "Manages brand voice, reviews content for brand consistency, learns from feedback",
      version: "2.0.0",
      capabilities: [
        {
          name: "get-guidelines",
          description: "Get brand guidelines formatted for content creation",
          inputSchema: { brandName: "string?" },
          outputSchema: { guidelines: "string" },
        },
        {
          name: "review-brand",
          description: "Review content for brand voice consistency",
          inputSchema: { content: "string", brandName: "string?" },
          outputSchema: { score: "number", feedback: "string[]", revised: "string?" },
        },
        {
          name: "learn",
          description: "Learn from feedback to improve brand understanding",
          inputSchema: { feedback: "string", context: "string?" },
          outputSchema: { learned: "string" },
        },
      ],
    });
    this.llm = llm;
    this.memory = memory;
  }

  async handle(message: Message): Promise<Message> {
    const task = message.payload as TaskPayload;

    try {
      let output: any;

      switch (task.action) {
        case "get-guidelines":
          output = await this.getGuidelines(task.input.brandName);
          break;
        case "review-brand":
          output = await this.reviewBrand(task.input);
          break;
        case "learn":
          output = await this.learn(task.input);
          break;
        default:
          output = await this.getGuidelines(task.input.brandName);
      }

      return createMessage(this.name, message.from, "result", {
        success: true,
        output,
      } satisfies ResultPayload, message.id);
    } catch (err: any) {
      return createMessage(this.name, message.from, "error", {
        code: "BRAND_ERROR",
        message: err.message,
        retryable: false,
      }, message.id);
    }
  }

  private async getGuidelines(brandName?: string): Promise<any> {
    // Pull brand info from memory
    const brandEntries = this.memory.byAgent("brand-manager");
    const learnings = brandEntries
      .filter((e) => e.tags?.includes("learning"))
      .map((e) => `- ${e.value}`)
      .join("\n");

    const brandKey = brandName ? `brand:${brandName}` : undefined;
    const profile = brandKey ? this.memory.get(brandKey) : null;

    let guidelines = "";
    if (profile) {
      const p = profile.value as BrandProfile;
      guidelines = `## Brand Guidelines — ${p.name}\n\n`;
      guidelines += `**Voice:** ${p.voice}\n`;
      guidelines += `**Tone:** ${p.tone}\n`;
      guidelines += `**Audience:** ${p.audience}\n`;
      guidelines += `**Industry:** ${p.industry}\n`;
      if (p.keywords?.length) guidelines += `**Keywords:** ${p.keywords.join(", ")}\n`;
      if (p.avoidWords?.length) guidelines += `**Never use:** ${p.avoidWords.join(", ")}\n`;
    } else {
      guidelines = "No specific brand profile found. Using defaults.\n";
    }

    if (learnings) {
      guidelines += `\n**Learned preferences:**\n${learnings}\n`;
    }

    return { guidelines };
  }

  private async reviewBrand(input: any): Promise<any> {
    const { guidelines } = await this.getGuidelines(input.brandName);

    const messages: LLMMessage[] = [
      {
        role: "system",
        content: `You are a brand consistency reviewer. Check content against brand guidelines and flag any deviations. Output valid JSON.`,
      },
      {
        role: "user",
        content: `Review this content for brand consistency:

${guidelines}

Content:
${input.content}

Return JSON:
{
  "score": 0-100,
  "feedback": ["specific feedback items"],
  "issues": ["any brand guideline violations"]
}`,
      },
    ];

    const response = await this.llm.chat(messages);

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch?.[0] || "{}");
    } catch {
      return { score: 0, feedback: [response.content], issues: [] };
    }
  }

  private async learn(input: any): Promise<any> {
    const learning = input.feedback;
    await this.memory.set(
      `learning:${Date.now()}`,
      learning,
      "brand-manager",
      ["learning", "brand"],
    );
    return { learned: learning, stored: true };
  }
}
