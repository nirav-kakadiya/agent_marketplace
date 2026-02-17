// Trend Finder — discover trending topics from Reddit, HN, and search trends

import { webSearch, type SearchConfig, type SearchResult } from "./web-search";
import type { LLM, LLMMessage } from "../../../core/llm";

export interface TrendResult {
  topic: string;
  source: string;
  url: string;
  engagement: string;
  relevance: string;
}

export interface TrendAnalysis {
  trends: TrendResult[];
  hotTopics: string[];
  contentOpportunities: string[];
  summary: string;
}

export async function findTrends(
  industry: string,
  llm: LLM,
  searchConfig: SearchConfig,
): Promise<TrendAnalysis> {
  // Search multiple sources
  const queries = [
    `${industry} trending topics ${new Date().getFullYear()}`,
    `${industry} latest news today`,
    `site:reddit.com ${industry} trending`,
    `site:news.ycombinator.com ${industry}`,
  ];

  const allResults: SearchResult[] = [];
  for (const q of queries) {
    try {
      const results = await webSearch(q, searchConfig, 5);
      allResults.push(...results);
    } catch {}
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  const unique = allResults.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  const context = unique
    .slice(0, 15)
    .map((r) => `- ${r.title} (${r.url})\n  ${r.snippet}`)
    .join("\n");

  const messages: LLMMessage[] = [
    {
      role: "system",
      content: `You are a trend analyst. Identify trending topics and content opportunities from search results. Output valid JSON only.`,
    },
    {
      role: "user",
      content: `Find trending topics in "${industry}" from these search results:

${context}

Return JSON:
{
  "trends": [{ "topic": "", "source": "", "url": "", "engagement": "high|medium|low", "relevance": "high|medium|low" }],
  "hotTopics": ["topic1", "topic2"],
  "contentOpportunities": ["opportunity1", "opportunity2"],
  "summary": ""
}`,
    },
  ];

  const response = await llm.chat(messages);

  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch?.[0] || "{}");
  } catch {
    return { trends: [], hotTopics: [], contentOpportunities: [], summary: response.content };
  }
}
