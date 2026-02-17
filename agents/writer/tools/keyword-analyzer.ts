// Keyword Analyzer — find and analyze keywords for SEO content

import type { LLM, LLMMessage } from "../../../core/llm";
import { webSearch, type SearchConfig } from "../../researcher/tools/web-search";

export interface KeywordData {
  keyword: string;
  intent: "informational" | "navigational" | "transactional" | "commercial";
  difficulty: "easy" | "medium" | "hard";
  priority: "high" | "medium" | "low";
  relatedKeywords: string[];
  suggestedTitle: string;
}

export interface KeywordAnalysis {
  primaryKeyword: string;
  keywords: KeywordData[];
  contentAngle: string;
  targetWordCount: number;
}

export async function analyzeKeywords(
  topic: string,
  llm: LLM,
  searchConfig: SearchConfig,
): Promise<KeywordAnalysis> {
  // 1. Search to understand the SERP landscape
  const results = await webSearch(topic, searchConfig, 10);
  const serpTitles = results.map((r) => `- ${r.title}`).join("\n");

  // 2. LLM generates keyword strategy
  const messages: LLMMessage[] = [
    {
      role: "system",
      content: `You are an SEO keyword strategist. Analyze search results and suggest optimal keywords. Output valid JSON only.`,
    },
    {
      role: "user",
      content: `Topic: "${topic}"

Current SERP titles for this topic:
${serpTitles}

Analyze and return JSON:
{
  "primaryKeyword": "main target keyword",
  "keywords": [
    {
      "keyword": "",
      "intent": "informational|navigational|transactional|commercial",
      "difficulty": "easy|medium|hard",
      "priority": "high|medium|low",
      "relatedKeywords": [],
      "suggestedTitle": ""
    }
  ],
  "contentAngle": "unique angle to differentiate from existing SERP results",
  "targetWordCount": 1500
}

Suggest 5-10 keywords. Focus on gaps in existing SERP coverage.`,
    },
  ];

  const response = await llm.chat(messages);

  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch?.[0] || "{}");
  } catch {
    return {
      primaryKeyword: topic,
      keywords: [],
      contentAngle: response.content,
      targetWordCount: 1500,
    };
  }
}
