// Editor Agent — reviews, improves, and optimizes content

import { BaseAgent } from "../../core/agent";
import { createMessage, type Message, type TaskPayload, type ResultPayload } from "../../core/message";
import { LLM, type LLMMessage } from "../../core/llm";

export class EditorAgent extends BaseAgent {
  private llm: LLM;

  constructor(llm: LLM) {
    super({
      name: "editor",
      description: "Reviews and improves content — grammar, SEO, readability, fact-checking",
      version: "2.0.0",
      capabilities: [
        {
          name: "edit",
          description: "Full editorial review — grammar, clarity, structure, SEO",
          inputSchema: { content: "string", focus: "string?" },
          outputSchema: { editedContent: "string", changes: "string[]", score: "object" },
        },
        {
          name: "seo-optimize",
          description: "Optimize content for specific keywords",
          inputSchema: { content: "string", keywords: "string[]", metaDescription: "string?" },
          outputSchema: { optimizedContent: "string", seoScore: "number", suggestions: "string[]" },
        },
      ],
    });
    this.llm = llm;
  }

  async handle(message: Message): Promise<Message> {
    const task = message.payload as TaskPayload;

    try {
      let output: any;

      switch (task.action) {
        case "seo-optimize":
          output = await this.seoOptimize(task.input);
          break;
        case "edit":
        default:
          output = await this.fullEdit(task.input);
      }

      return createMessage(this.name, message.from, "result", {
        success: true,
        output,
      } satisfies ResultPayload, message.id);
    } catch (err: any) {
      return createMessage(this.name, message.from, "error", {
        code: "EDITOR_ERROR",
        message: err.message,
        retryable: true,
      }, message.id);
    }
  }

  private async fullEdit(input: any): Promise<any> {
    const messages: LLMMessage[] = [
      {
        role: "system",
        content: `You are a senior editor. Review and improve the content while maintaining the author's voice.

Review checklist:
1. Grammar & spelling
2. Clarity & readability (aim for grade 8 reading level)
3. Structure & flow
4. Engagement & hook strength
5. SEO (headings, keyword placement, meta)
6. Factual accuracy flags
7. CTA effectiveness

Output the FULL improved content, then a summary of changes.`,
      },
      {
        role: "user",
        content: `Edit this content${input.focus ? ` (focus on: ${input.focus})` : ""}:

${input.content}

Return the improved version, then list all changes made.`,
      },
    ];

    const response = await this.llm.chat(messages);

    // Parse response — content before "## Changes" or similar
    const parts = response.content.split(/##\s*(Changes|Summary of Changes|Edits Made)/i);

    return {
      editedContent: parts[0].trim(),
      changes: parts.length > 1 ? parts.slice(1).join("").trim().split("\n").filter((l: string) => l.trim()) : [],
      score: {
        grammar: "reviewed",
        readability: "optimized",
        seo: "reviewed",
      },
    };
  }

  private async seoOptimize(input: any): Promise<any> {
    const keywords = input.keywords || [];

    const messages: LLMMessage[] = [
      {
        role: "system",
        content: `You are an SEO specialist. Optimize content for search engines while keeping it natural and readable.

Optimization rules:
- Primary keyword in first 100 words, title, and 1-2 H2s
- Natural keyword density (1-2%)
- Related/LSI keywords sprinkled throughout
- Short paragraphs (2-3 sentences)
- Include questions (for featured snippets)
- Internal/external link placeholders
- Strong meta description if not provided`,
      },
      {
        role: "user",
        content: `Optimize this content for keywords: ${keywords.join(", ")}

${input.content}

${input.metaDescription ? `Current meta: ${input.metaDescription}` : "Also write a meta description."}

Return the optimized content.`,
      },
    ];

    const response = await this.llm.chat(messages);

    return {
      optimizedContent: response.content,
      keywords,
      suggestions: [],
    };
  }
}
