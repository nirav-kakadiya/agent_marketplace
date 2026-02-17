// Competitor Analysis — analyze competitor websites, content, and strategy

import type { LLM, LLMMessage } from "../../../core/llm";
import { webSearch, type SearchConfig, type SearchResult } from "./web-search";
import { scrapePage, type ScrapedPage } from "./web-scraper";

export interface CompetitorProfile {
  name: string;
  url: string;
  description: string;
  strengths: string[];
  weaknesses: string[];
  contentTopics: string[];
  socialPresence: string[];
  keyDifferentiators: string[];
}

export interface CompetitorAnalysis {
  competitors: CompetitorProfile[];
  marketGaps: string[];
  recommendations: string[];
  summary: string;
}

export async function analyzeCompetitors(
  topic: string,
  llm: LLM,
  searchConfig: SearchConfig,
  maxCompetitors: number = 5,
): Promise<CompetitorAnalysis> {
  // 1. Find competitors
  const searchResults = await webSearch(`${topic} best tools alternatives`, searchConfig, 10);

  // 2. Scrape top results
  const pages: ScrapedPage[] = [];
  for (const result of searchResults.slice(0, maxCompetitors)) {
    try {
      const page = await scrapePage(result.url, 8000);
      pages.push(page);
    } catch {
      pages.push({ url: result.url, title: result.title, content: result.snippet, wordCount: 0, headings: [] });
    }
  }

  // 3. LLM analyzes the data
  const context = pages
    .map((p, i) => `### Competitor ${i + 1}: ${p.title}\nURL: ${p.url}\nHeadings: ${p.headings.join(", ")}\nContent preview: ${p.content.slice(0, 2000)}`)
    .join("\n\n");

  const messages: LLMMessage[] = [
    {
      role: "system",
      content: `You are a competitive intelligence analyst. Analyze competitor websites and provide structured insights. Output valid JSON only.`,
    },
    {
      role: "user",
      content: `Analyze these competitors for "${topic}":

${context}

Return JSON:
{
  "competitors": [{ "name": "", "url": "", "description": "", "strengths": [], "weaknesses": [], "contentTopics": [], "socialPresence": [], "keyDifferentiators": [] }],
  "marketGaps": [],
  "recommendations": [],
  "summary": ""
}`,
    },
  ];

  const response = await llm.chat(messages);

  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch?.[0] || "{}");
  } catch {
    return {
      competitors: [],
      marketGaps: [],
      recommendations: [],
      summary: response.content,
    };
  }
}
