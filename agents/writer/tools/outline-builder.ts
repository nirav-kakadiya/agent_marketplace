// Outline Builder — create SEO-optimized content outlines

import type { LLM, LLMMessage } from "../../../core/llm";
import type { KeywordAnalysis } from "./keyword-analyzer";

export interface ContentOutline {
  title: string;
  metaDescription: string;
  slug: string;
  sections: OutlineSection[];
  targetWordCount: number;
  toneGuide: string;
}

export interface OutlineSection {
  heading: string;
  headingLevel: number;  // h2, h3
  keyPoints: string[];
  targetWords: number;
  keywords: string[];    // keywords to naturally include
}

export async function buildOutline(
  topic: string,
  keywordAnalysis: KeywordAnalysis,
  llm: LLM,
  brandGuidelines?: string,
): Promise<ContentOutline> {
  const keywordList = keywordAnalysis.keywords
    .map((k) => `- ${k.keyword} (${k.intent}, ${k.priority} priority)`)
    .join("\n");

  const messages: LLMMessage[] = [
    {
      role: "system",
      content: `You are an SEO content strategist. Create detailed, SEO-optimized content outlines that will rank well and engage readers. Output valid JSON only.`,
    },
    {
      role: "user",
      content: `Create a content outline for: "${topic}"

Primary keyword: ${keywordAnalysis.primaryKeyword}
Content angle: ${keywordAnalysis.contentAngle}
Target word count: ${keywordAnalysis.targetWordCount}

Keywords to include naturally:
${keywordList}

${brandGuidelines ? `\nBrand guidelines:\n${brandGuidelines}` : ""}

Return JSON:
{
  "title": "SEO-optimized title with primary keyword",
  "metaDescription": "155 char meta description with primary keyword",
  "slug": "url-friendly-slug",
  "sections": [
    {
      "heading": "H2 heading",
      "headingLevel": 2,
      "keyPoints": ["point 1", "point 2"],
      "targetWords": 300,
      "keywords": ["keywords to include in this section"]
    }
  ],
  "targetWordCount": ${keywordAnalysis.targetWordCount},
  "toneGuide": "tone and style guidance"
}

Include 5-8 sections. Start with a hook, end with a strong CTA. Include an FAQ section.`,
    },
  ];

  const response = await llm.chat(messages);

  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch?.[0] || "{}");
  } catch {
    return {
      title: topic,
      metaDescription: "",
      slug: topic.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      sections: [],
      targetWordCount: keywordAnalysis.targetWordCount,
      toneGuide: "",
    };
  }
}
