// Writer Agent — SEO-first content creation with keyword research + outlining

import { BaseAgent } from "../../core/agent";
import { createMessage, type Message, type TaskPayload, type ResultPayload } from "../../core/message";
import { LLM, type LLMMessage } from "../../core/llm";
import type { Memory } from "../../core/memory";
import type { SearchConfig } from "../researcher/tools/web-search";
import { analyzeKeywords, type KeywordAnalysis } from "./tools/keyword-analyzer";
import { buildOutline, type ContentOutline } from "./tools/outline-builder";
import { analyzeSERP } from "./tools/serp-analyzer";

export class WriterAgent extends BaseAgent {
  private llm: LLM;
  private memory: Memory;
  private searchConfig: SearchConfig;

  constructor(llm: LLM, memory: Memory, searchConfig: SearchConfig) {
    super({
      name: "writer",
      description: "Writes SEO-optimized content — blog posts, landing pages, email sequences",
      version: "2.0.0",
      capabilities: [
        {
          name: "write-blog",
          description: "Write an SEO-optimized blog post with keyword research and outlining",
          inputSchema: { topic: "string", research: "string?", brandGuidelines: "string?", wordCount: "number?" },
          outputSchema: { title: "string", content: "string", metadata: "object" },
        },
        {
          name: "write-from-outline",
          description: "Write content from a provided outline",
          inputSchema: { outline: "object", research: "string?", brandGuidelines: "string?" },
          outputSchema: { title: "string", content: "string" },
        },
        {
          name: "keyword-research",
          description: "Perform keyword research for a topic",
          inputSchema: { topic: "string" },
          outputSchema: { keywords: "object[]", contentAngle: "string" },
        },
        {
          name: "serp-analysis",
          description: "Analyze top search results for a keyword",
          inputSchema: { keyword: "string" },
          outputSchema: { analysis: "object" },
        },
      ],
    });
    this.llm = llm;
    this.memory = memory;
    this.searchConfig = searchConfig;
  }

  async handle(message: Message): Promise<Message> {
    const task = message.payload as TaskPayload;
    const action = task.action;

    try {
      let output: any;

      switch (action) {
        case "write-blog":
          output = await this.writeBlog(task.input);
          break;
        case "write-from-outline":
          output = await this.writeFromOutline(task.input.outline, task.input);
          break;
        case "keyword-research":
          output = await analyzeKeywords(task.input.topic, this.llm, this.searchConfig);
          break;
        case "serp-analysis":
          output = await analyzeSERP(task.input.keyword, this.llm, this.searchConfig);
          break;
        default:
          output = await this.writeBlog(task.input);
      }

      // Save to memory
      if (output.title) {
        await this.memory.set(
          `content:${Date.now()}`,
          { title: output.title, topic: task.input.topic, createdAt: new Date().toISOString() },
          this.name,
          ["content", "blog"],
        );
      }

      return createMessage(this.name, message.from, "result", {
        success: true,
        output,
      } satisfies ResultPayload, message.id);
    } catch (err: any) {
      return createMessage(this.name, message.from, "error", {
        code: "WRITER_ERROR",
        message: err.message,
        retryable: true,
      }, message.id);
    }
  }

  private async writeBlog(input: any): Promise<any> {
    const topic = input.topic;
    const brandGuidelines = input.brandGuidelines || "";

    // Step 1: Keyword research
    const keywords = await analyzeKeywords(topic, this.llm, this.searchConfig);

    // Step 2: Build outline
    const outline = await buildOutline(topic, keywords, this.llm, brandGuidelines);

    // Step 3: Write content from outline
    const content = await this.writeFromOutline(outline, input);

    return {
      ...content,
      keywords,
      outline,
      metadata: {
        primaryKeyword: keywords.primaryKeyword,
        metaDescription: outline.metaDescription,
        slug: outline.slug,
        wordCount: content.content.split(/\s+/).length,
        targetWordCount: outline.targetWordCount,
      },
    };
  }

  private async writeFromOutline(outline: ContentOutline, input: any): Promise<any> {
    const sectionPrompts = outline.sections
      .map((s) => {
        const keywords = s.keywords?.length ? `\nNaturally include keywords: ${s.keywords.join(", ")}` : "";
        return `## ${s.heading}\nKey points: ${s.keyPoints.join("; ")}\nTarget: ~${s.targetWords} words${keywords}`;
      })
      .join("\n\n");

    const messages: LLMMessage[] = [
      {
        role: "system",
        content: `You are an expert content writer. Write engaging, SEO-optimized content that ranks well and provides genuine value.

Rules:
- Write naturally, avoid keyword stuffing
- Use short paragraphs (2-3 sentences max)
- Include real examples and actionable advice
- Use transition phrases between sections
- Write in markdown format
- Include internal linking opportunities as [anchor text](URL_PLACEHOLDER)
${input.brandGuidelines ? `\nBrand guidelines:\n${input.brandGuidelines}` : ""}`,
      },
      {
        role: "user",
        content: `Write a complete blog post.

Title: ${outline.title}
Meta Description: ${outline.metaDescription}
Tone: ${outline.toneGuide || "professional yet approachable"}
${input.research ? `\nResearch to incorporate:\n${typeof input.research === "string" ? input.research : JSON.stringify(input.research)}` : ""}

Sections to write:
${sectionPrompts}

Write the full article now. Start with an engaging intro (no heading for intro). Include all sections with proper H2/H3 headings.`,
      },
    ];

    const response = await this.llm.chat(messages);

    return {
      title: outline.title,
      content: response.content,
      metaDescription: outline.metaDescription,
      slug: outline.slug,
    };
  }
}
