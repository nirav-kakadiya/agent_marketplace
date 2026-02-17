// Social Writer Agent — converts content into platform-specific social posts

import { BaseAgent } from "../../core/agent";
import { createMessage, type Message, type TaskPayload, type ResultPayload } from "../../core/message";
import { LLM, type LLMMessage } from "../../core/llm";
import type { Memory } from "../../core/memory";

export interface SocialOutput {
  twitter: { posts: string[]; hashtags: string[] };
  linkedin: { post: string; hashtags: string[] };
  instagram: { caption: string; hashtags: string[] };
  facebook: { post: string };
}

export class SocialWriterAgent extends BaseAgent {
  private llm: LLM;
  private memory: Memory;

  constructor(llm: LLM, memory: Memory) {
    super({
      name: "social-writer",
      description: "Creates platform-optimized social media content from blogs, topics, or campaigns",
      version: "2.0.0",
      capabilities: [
        {
          name: "blog-to-social",
          description: "Convert a blog post into social media posts for all platforms",
          inputSchema: { content: "string", title: "string?", url: "string?", platforms: "string[]?" },
          outputSchema: { twitter: "object", linkedin: "object", instagram: "object", facebook: "object" },
        },
        {
          name: "write-social",
          description: "Write social posts for a topic/announcement",
          inputSchema: { topic: "string", type: "string?", platforms: "string[]?" },
          outputSchema: { posts: "object" },
        },
      ],
    });
    this.llm = llm;
    this.memory = memory;
  }

  async handle(message: Message): Promise<Message> {
    const task = message.payload as TaskPayload;

    try {
      const platforms = task.input.platforms || ["twitter", "linkedin", "instagram", "facebook"];
      let output: any;

      switch (task.action) {
        case "blog-to-social":
          output = await this.blogToSocial(task.input, platforms);
          break;
        case "write-social":
        default:
          output = await this.writeSocial(task.input, platforms);
      }

      return createMessage(this.name, message.from, "result", {
        success: true,
        output,
      } satisfies ResultPayload, message.id);
    } catch (err: any) {
      return createMessage(this.name, message.from, "error", {
        code: "SOCIAL_WRITER_ERROR",
        message: err.message,
        retryable: true,
      }, message.id);
    }
  }

  private async blogToSocial(input: any, platforms: string[]): Promise<SocialOutput> {
    const messages: LLMMessage[] = [
      {
        role: "system",
        content: `You are a social media expert. Convert blog content into engaging, platform-specific posts. Output valid JSON only.

Platform rules:
- Twitter/X: Max 280 chars per post. Create a thread (3-5 posts) for long content. Hook in first tweet. Use 2-3 hashtags.
- LinkedIn: Professional tone, 1300 chars max. Start with a hook. Use line breaks. 3-5 hashtags at end.
- Instagram: Engaging caption, emoji-friendly, 2200 chars max. 15-20 hashtags.
- Facebook: Conversational, 500 chars ideal. Question or hook at start. 1-2 hashtags max.`,
      },
      {
        role: "user",
        content: `Convert this blog to social posts:

Title: ${input.title || "Untitled"}
${input.url ? `URL: ${input.url}` : ""}
Content: ${typeof input.content === "string" ? input.content.slice(0, 3000) : JSON.stringify(input.content).slice(0, 3000)}

Platforms: ${platforms.join(", ")}

Return JSON:
{
  "twitter": { "posts": ["tweet 1", "tweet 2", "..."], "hashtags": [] },
  "linkedin": { "post": "", "hashtags": [] },
  "instagram": { "caption": "", "hashtags": [] },
  "facebook": { "post": "" }
}`,
      },
    ];

    const response = await this.llm.chat(messages);

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch?.[0] || "{}");
    } catch {
      return {
        twitter: { posts: [response.content.slice(0, 280)], hashtags: [] },
        linkedin: { post: response.content.slice(0, 1300), hashtags: [] },
        instagram: { caption: response.content.slice(0, 2200), hashtags: [] },
        facebook: { post: response.content.slice(0, 500) },
      };
    }
  }

  private async writeSocial(input: any, platforms: string[]): Promise<SocialOutput> {
    const messages: LLMMessage[] = [
      {
        role: "system",
        content: `You are a social media expert. Write engaging, platform-specific posts. Output valid JSON only.`,
      },
      {
        role: "user",
        content: `Write social posts about: "${input.topic}"
Type: ${input.type || "general post"}
Platforms: ${platforms.join(", ")}

Return JSON:
{
  "twitter": { "posts": ["tweet 1"], "hashtags": [] },
  "linkedin": { "post": "", "hashtags": [] },
  "instagram": { "caption": "", "hashtags": [] },
  "facebook": { "post": "" }
}`,
      },
    ];

    const response = await this.llm.chat(messages);

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch?.[0] || "{}");
    } catch {
      return {
        twitter: { posts: [], hashtags: [] },
        linkedin: { post: "", hashtags: [] },
        instagram: { caption: "", hashtags: [] },
        facebook: { post: "" },
      };
    }
  }
}
