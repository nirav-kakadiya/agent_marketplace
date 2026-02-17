// Researcher Agent — REAL web research with actual search + scraping

import { BaseAgent } from "../../core/agent";
import { createMessage, type Message, type TaskPayload, type ResultPayload } from "../../core/message";
import { LLM, type LLMMessage } from "../../core/llm";
import { webSearch, type SearchConfig, type SearchResult } from "./tools/web-search";
import { scrapePage, scrapeMultiple, type ScrapedPage } from "./tools/web-scraper";
import { analyzeCompetitors } from "./tools/competitor";
import { findTrends } from "./tools/trend-finder";

export class ResearcherAgent extends BaseAgent {
  private llm: LLM;
  private searchConfig: SearchConfig;

  constructor(llm: LLM, searchConfig: SearchConfig) {
    super({
      name: "researcher",
      description: "Researches topics using real web search, scraping, competitor analysis, and trend finding",
      version: "2.0.0",
      capabilities: [
        {
          name: "research",
          description: "Research a topic with real web search and content analysis",
          inputSchema: { topic: "string", depth: "quick|deep" },
          outputSchema: { findings: "string", sources: "object[]" },
        },
        {
          name: "competitor-analysis",
          description: "Analyze competitors in a market/niche",
          inputSchema: { topic: "string", maxCompetitors: "number?" },
          outputSchema: { competitors: "object[]", gaps: "string[]" },
        },
        {
          name: "trend-research",
          description: "Find trending topics and content opportunities",
          inputSchema: { industry: "string" },
          outputSchema: { trends: "object[]", opportunities: "string[]" },
        },
        {
          name: "scrape-url",
          description: "Scrape and extract content from a URL",
          inputSchema: { url: "string" },
          outputSchema: { content: "string", title: "string" },
        },
      ],
    });
    this.llm = llm;
    this.searchConfig = searchConfig;
  }

  async handle(message: Message): Promise<Message> {
    const task = message.payload as TaskPayload;
    const action = task.action;

    try {
      let output: any;

      switch (action) {
        case "research":
          output = await this.research(task.input.topic, task.input.depth || "quick");
          break;
        case "competitor-analysis":
          output = await analyzeCompetitors(task.input.topic, this.llm, this.searchConfig, task.input.maxCompetitors);
          break;
        case "trend-research":
          output = await findTrends(task.input.industry, this.llm, this.searchConfig);
          break;
        case "scrape-url":
          output = await scrapePage(task.input.url);
          break;
        default:
          // Default to research
          output = await this.research(task.input.topic || JSON.stringify(task.input), "quick");
      }

      return createMessage(this.name, message.from, "result", {
        success: true,
        output,
      } satisfies ResultPayload, message.id);
    } catch (err: any) {
      return createMessage(this.name, message.from, "error", {
        code: "RESEARCH_ERROR",
        message: err.message,
        retryable: true,
      }, message.id);
    }
  }

  private async research(topic: string, depth: string): Promise<any> {
    // 1. Search the web
    const numResults = depth === "deep" ? 10 : 5;
    const searchResults = await webSearch(topic, this.searchConfig, numResults);

    // 2. Scrape top results for deep research
    let scrapedContent: ScrapedPage[] = [];
    if (depth === "deep") {
      scrapedContent = await scrapeMultiple(
        searchResults.slice(0, 5).map((r) => r.url),
        8000,
      );
    }

    // 3. LLM synthesizes findings
    const searchContext = searchResults
      .map((r, i) => `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet}`)
      .join("\n\n");

    const scrapedContext = scrapedContent.length
      ? "\n\n## Detailed Content:\n" +
        scrapedContent
          .map((p) => `### ${p.title} (${p.url})\n${p.content.slice(0, 3000)}`)
          .join("\n\n")
      : "";

    const messages: LLMMessage[] = [
      {
        role: "system",
        content: `You are a research analyst. Synthesize web search results into comprehensive, well-structured findings. Always cite sources with URLs. Be factual — only report what the sources say.`,
      },
      {
        role: "user",
        content: `Research topic: "${topic}"

## Search Results:
${searchContext}
${scrapedContext}

Provide a comprehensive research report with:
1. Key Findings (with source citations)
2. Important Statistics & Data Points
3. Current Trends
4. Different Perspectives/Opinions
5. Actionable Insights`,
      },
    ];

    const response = await this.llm.chat(messages);

    return {
      topic,
      depth,
      findings: response.content,
      sources: searchResults.map((r) => ({ title: r.title, url: r.url })),
      pagesScraped: scrapedContent.length,
    };
  }
}
