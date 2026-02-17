// SERP Analyzer — analyze top search results to understand what ranks

import type { LLM, LLMMessage } from "../../../core/llm";
import { webSearch, type SearchConfig } from "../../researcher/tools/web-search";
import { scrapeMultiple, type ScrapedPage } from "../../researcher/tools/web-scraper";

export interface SERPAnalysis {
  keyword: string;
  topResults: SERPResult[];
  commonTopics: string[];
  contentGaps: string[];
  avgWordCount: number;
  dominantFormat: string;
  recommendedApproach: string;
}

export interface SERPResult {
  position: number;
  title: string;
  url: string;
  wordCount: number;
  headings: string[];
}

export async function analyzeSERP(
  keyword: string,
  llm: LLM,
  searchConfig: SearchConfig,
): Promise<SERPAnalysis> {
  // 1. Search for the keyword
  const results = await webSearch(keyword, searchConfig, 10);

  // 2. Scrape top 3 results for deeper analysis
  const pages = await scrapeMultiple(
    results.slice(0, 3).map((r) => r.url),
    5000,
  );

  // 3. Build SERP analysis context
  const serpContext = results
    .map((r, i) => {
      const page = pages.find((p) => p.url === r.url);
      return `${i + 1}. "${r.title}" — ${r.url}\n   Word count: ${page?.wordCount || "N/A"}\n   Headings: ${page?.headings?.slice(0, 5).join(", ") || "N/A"}\n   Snippet: ${r.snippet}`;
    })
    .join("\n\n");

  const messages: LLMMessage[] = [
    {
      role: "system",
      content: `You are an SEO analyst. Analyze SERP results and identify patterns, gaps, and opportunities. Output valid JSON only.`,
    },
    {
      role: "user",
      content: `Analyze the SERP for keyword: "${keyword}"

${serpContext}

Return JSON:
{
  "keyword": "${keyword}",
  "topResults": [{"position": 1, "title": "", "url": "", "wordCount": 0, "headings": []}],
  "commonTopics": ["topics covered by most results"],
  "contentGaps": ["topics NOT covered that should be"],
  "avgWordCount": 0,
  "dominantFormat": "listicle|guide|tutorial|comparison|review",
  "recommendedApproach": "how to create content that outranks these"
}`,
    },
  ];

  const response = await llm.chat(messages);

  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch?.[0] || "{}");
  } catch {
    return {
      keyword,
      topResults: [],
      commonTopics: [],
      contentGaps: [],
      avgWordCount: 0,
      dominantFormat: "unknown",
      recommendedApproach: response.content,
    };
  }
}
