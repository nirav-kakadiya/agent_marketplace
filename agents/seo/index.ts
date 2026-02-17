// SEO Agent — full SEO management: audits, keywords, rank tracking, backlink analysis

import { BaseAgent } from "../../core/agent";
import { createMessage, type Message, type TaskPayload, type ResultPayload } from "../../core/message";
import { LLM, type LLMMessage } from "../../core/llm";
import type { Memory } from "../../core/memory";
import { webSearch, type SearchConfig } from "../researcher/tools/web-search";
import { scrapePage } from "../researcher/tools/web-scraper";

export class SEOAgent extends BaseAgent {
  private llm: LLM;
  private memory: Memory;
  private searchConfig: SearchConfig;

  constructor(llm: LLM, memory: Memory, searchConfig: SearchConfig) {
    super({
      name: "seo-agent",
      description: "Full SEO management — site audits, keyword research, SERP analysis, content optimization, rank tracking",
      version: "1.0.0",
      capabilities: [
        { name: "site-audit", description: "Audit a website for SEO issues", inputSchema: { url: "string" }, outputSchema: { audit: "object" } },
        { name: "keyword-research", description: "Deep keyword research with volume/difficulty estimates", inputSchema: { topic: "string", niche: "string?" }, outputSchema: { keywords: "object[]" } },
        { name: "content-optimize", description: "Optimize existing content for target keywords", inputSchema: { content: "string", keywords: "string[]" }, outputSchema: { optimized: "string", suggestions: "string[]" } },
        { name: "backlink-analyze", description: "Analyze backlink profile and find opportunities", inputSchema: { url: "string" }, outputSchema: { analysis: "object" } },
        { name: "rank-check", description: "Check rankings for keywords", inputSchema: { url: "string", keywords: "string[]" }, outputSchema: { rankings: "object[]" } },
        { name: "seo-roadmap", description: "Create a full SEO strategy roadmap", inputSchema: { url: "string", goals: "string?" }, outputSchema: { roadmap: "object" } },
      ],
    });
    this.llm = llm;
    this.memory = memory;
    this.searchConfig = searchConfig;
  }

  async handle(message: Message): Promise<Message> {
    const task = message.payload as TaskPayload;
    try {
      let output: any;
      switch (task.action) {
        case "site-audit": output = await this.siteAudit(task.input.url); break;
        case "keyword-research": output = await this.keywordResearch(task.input); break;
        case "content-optimize": output = await this.contentOptimize(task.input); break;
        case "backlink-analyze": output = await this.backlinkAnalyze(task.input.url); break;
        case "rank-check": output = await this.rankCheck(task.input); break;
        case "seo-roadmap": output = await this.seoRoadmap(task.input); break;
        default: output = await this.siteAudit(task.input.url || task.input.topic);
      }
      return createMessage(this.name, message.from, "result", { success: true, output } satisfies ResultPayload, message.id);
    } catch (err: any) {
      return createMessage(this.name, message.from, "error", { code: "SEO_ERROR", message: err.message, retryable: true }, message.id);
    }
  }

  private async siteAudit(url: string): Promise<any> {
    const page = await scrapePage(url, 20000);
    const messages: LLMMessage[] = [
      { role: "system", content: `You are an SEO auditor. Analyze the webpage and provide a detailed audit. Output valid JSON.` },
      { role: "user", content: `Audit this page for SEO:
URL: ${url}
Title: ${page.title}
Headings: ${page.headings.join(", ")}
Word count: ${page.wordCount}
Content preview: ${page.content.slice(0, 5000)}

Return JSON:
{
  "url": "${url}",
  "score": 0-100,
  "title": { "text": "", "length": 0, "hasKeyword": false, "suggestion": "" },
  "meta": { "description": "", "length": 0, "suggestion": "" },
  "headings": { "h1Count": 0, "h2Count": 0, "structure": "good|needs-work|poor" },
  "content": { "wordCount": 0, "readability": "easy|medium|hard", "keywordDensity": "" },
  "technical": { "https": true, "mobileHint": "", "speedHint": "" },
  "issues": [{ "severity": "high|medium|low", "issue": "", "fix": "" }],
  "opportunities": [""],
  "summary": ""
}` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { summary: response.content }; }
  }

  private async keywordResearch(input: any): Promise<any> {
    const topic = input.topic;
    const results = await webSearch(`${topic} best`, this.searchConfig, 10);
    const relatedResults = await webSearch(`${topic} alternatives comparison`, this.searchConfig, 5);
    const allTitles = [...results, ...relatedResults].map(r => `- ${r.title}`).join("\n");

    const messages: LLMMessage[] = [
      { role: "system", content: `You are an SEO keyword strategist. Analyze search landscape and provide comprehensive keyword research. Output valid JSON.` },
      { role: "user", content: `Deep keyword research for: "${topic}"
${input.niche ? `Niche: ${input.niche}` : ""}

Current SERP titles:
${allTitles}

Return JSON:
{
  "primaryKeyword": "",
  "keywords": [
    { "keyword": "", "intent": "informational|navigational|transactional|commercial", "difficulty": "easy|medium|hard", "estimatedVolume": "high|medium|low", "priority": "high|medium|low", "contentType": "blog|landing|comparison|tutorial" }
  ],
  "longTailKeywords": [""],
  "questions": ["people also ask questions"],
  "contentGaps": ["topics competitors miss"],
  "strategy": ""
}

Provide 15-20 keywords with long-tail variations.` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { strategy: response.content }; }
  }

  private async contentOptimize(input: any): Promise<any> {
    const messages: LLMMessage[] = [
      { role: "system", content: `You are an on-page SEO specialist. Optimize content for target keywords while keeping it natural and engaging.` },
      { role: "user", content: `Optimize this content for keywords: ${input.keywords.join(", ")}

${input.content}

Return the optimized content with:
1. Keywords naturally placed (first 100 words, headings, throughout)
2. Improved meta description
3. Better heading structure
4. Internal link suggestions [anchor](URL_PLACEHOLDER)
5. FAQ section for featured snippets` },
    ];
    const response = await this.llm.chat(messages);
    return { optimizedContent: response.content, keywords: input.keywords };
  }

  private async backlinkAnalyze(url: string): Promise<any> {
    const results = await webSearch(`"${url}" -site:${new URL(url).hostname}`, this.searchConfig, 10);
    const competitorResults = await webSearch(`${new URL(url).hostname} competitors backlinks`, this.searchConfig, 5);

    const messages: LLMMessage[] = [
      { role: "system", content: `You are a backlink analyst. Analyze the link profile and suggest opportunities. Output valid JSON.` },
      { role: "user", content: `Backlink analysis for: ${url}

Found mentions/links:
${results.map(r => `- ${r.title} (${r.url})`).join("\n")}

Competitor landscape:
${competitorResults.map(r => `- ${r.title}: ${r.snippet}`).join("\n")}

Return JSON:
{
  "url": "${url}",
  "foundBacklinks": [{ "source": "", "url": "", "type": "dofollow|nofollow|mention" }],
  "opportunities": [{ "type": "guest-post|directory|resource-page|broken-link", "target": "", "description": "", "difficulty": "easy|medium|hard" }],
  "competitorInsights": [""],
  "strategy": "",
  "priorityActions": [""]
}` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { strategy: response.content }; }
  }

  private async rankCheck(input: any): Promise<any> {
    const rankings: any[] = [];
    for (const keyword of (input.keywords || []).slice(0, 10)) {
      const results = await webSearch(keyword, this.searchConfig, 10);
      const domain = new URL(input.url).hostname;
      const position = results.findIndex(r => r.url.includes(domain));
      rankings.push({
        keyword,
        position: position >= 0 ? position + 1 : "Not in top 10",
        url: position >= 0 ? results[position].url : null,
        topResult: results[0]?.title || "",
      });
    }
    return { url: input.url, rankings, checkedAt: new Date().toISOString() };
  }

  private async seoRoadmap(input: any): Promise<any> {
    const page = await scrapePage(input.url, 10000);
    const messages: LLMMessage[] = [
      { role: "system", content: `You are an SEO strategist. Create a comprehensive 3-month SEO roadmap. Output valid JSON.` },
      { role: "user", content: `Create SEO roadmap for: ${input.url}
${input.goals ? `Goals: ${input.goals}` : ""}

Current site:
Title: ${page.title}
Headings: ${page.headings.slice(0, 10).join(", ")}
Word count: ${page.wordCount}

Return JSON:
{
  "url": "${input.url}",
  "currentState": { "strengths": [], "weaknesses": [], "score": 0 },
  "month1": { "focus": "", "tasks": [{ "task": "", "priority": "high|medium|low", "impact": "high|medium|low" }] },
  "month2": { "focus": "", "tasks": [] },
  "month3": { "focus": "", "tasks": [] },
  "kpis": [{ "metric": "", "current": "", "target": "" }],
  "quickWins": [""],
  "summary": ""
}` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { summary: response.content }; }
  }
}
