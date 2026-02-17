// Social Media Manager Agent — content calendar, scheduling, engagement, analytics

import { BaseAgent } from "../../core/agent";
import { createMessage, type Message, type TaskPayload, type ResultPayload } from "../../core/message";
import { LLM, type LLMMessage } from "../../core/llm";
import type { Memory } from "../../core/memory";
import { webSearch, type SearchConfig } from "../researcher/tools/web-search";

export class SocialMediaManagerAgent extends BaseAgent {
  private llm: LLM;
  private memory: Memory;
  private searchConfig: SearchConfig;

  constructor(llm: LLM, memory: Memory, searchConfig: SearchConfig) {
    super({
      name: "social-media-manager",
      description: "Full social media management — content calendar, daily posts, trend monitoring, engagement, analytics",
      version: "1.0.0",
      capabilities: [
        { name: "content-calendar", description: "Create a content calendar for X days", inputSchema: { days: "number", niche: "string", platforms: "string[]?" }, outputSchema: { calendar: "object[]" } },
        { name: "daily-posts", description: "Generate today's posts for all platforms", inputSchema: { niche: "string", platforms: "string[]?" }, outputSchema: { posts: "object" } },
        { name: "find-trends", description: "Find trending topics to post about", inputSchema: { niche: "string" }, outputSchema: { trends: "object[]" } },
        { name: "engagement-replies", description: "Generate reply suggestions for comments", inputSchema: { comments: "string[]", brandVoice: "string?" }, outputSchema: { replies: "object[]" } },
        { name: "hashtag-research", description: "Research optimal hashtags for a topic", inputSchema: { topic: "string", platform: "string?" }, outputSchema: { hashtags: "object" } },
        { name: "post-analyzer", description: "Analyze a post's potential performance", inputSchema: { post: "string", platform: "string" }, outputSchema: { analysis: "object" } },
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
        case "content-calendar": output = await this.contentCalendar(task.input); break;
        case "daily-posts": output = await this.dailyPosts(task.input); break;
        case "find-trends": output = await this.findTrends(task.input.niche); break;
        case "engagement-replies": output = await this.engagementReplies(task.input); break;
        case "hashtag-research": output = await this.hashtagResearch(task.input); break;
        case "post-analyzer": output = await this.postAnalyzer(task.input); break;
        default: output = await this.contentCalendar(task.input);
      }
      return createMessage(this.name, message.from, "result", { success: true, output } satisfies ResultPayload, message.id);
    } catch (err: any) {
      return createMessage(this.name, message.from, "error", { code: "SOCIAL_ERROR", message: err.message, retryable: true }, message.id);
    }
  }

  private async contentCalendar(input: any): Promise<any> {
    const days = input.days || 30;
    const platforms = input.platforms || ["twitter", "linkedin", "instagram"];

    const trends = await this.findTrends(input.niche);

    const messages: LLMMessage[] = [
      { role: "system", content: `You are a social media strategist. Create detailed content calendars with specific post ideas. Output valid JSON.` },
      { role: "user", content: `Create a ${days}-day content calendar:
Niche: ${input.niche}
Platforms: ${platforms.join(", ")}

Trending topics to incorporate:
${JSON.stringify(trends.hotTopics?.slice(0, 5) || [])}

Return JSON:
{
  "niche": "${input.niche}",
  "duration": "${days} days",
  "calendar": [
    {
      "day": 1,
      "date": "relative",
      "theme": "content theme for the day",
      "posts": [
        { "platform": "twitter", "type": "thread|single|poll|image", "content": "", "bestTime": "9:00 AM", "hashtags": [] }
      ]
    }
  ],
  "contentMix": { "educational": "40%", "entertaining": "20%", "promotional": "20%", "engagement": "20%" },
  "tips": []
}

Include variety: threads, polls, images, carousels, stories. Max 2-3 posts per day.` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { calendar: response.content }; }
  }

  private async dailyPosts(input: any): Promise<any> {
    const platforms = input.platforms || ["twitter", "linkedin", "instagram"];
    const messages: LLMMessage[] = [
      { role: "system", content: `Create today's social media posts, platform-optimized. Output valid JSON.` },
      { role: "user", content: `Generate today's posts:
Niche: ${input.niche}
Platforms: ${platforms.join(", ")}

Return JSON:
{
  "date": "${new Date().toISOString().split('T')[0]}",
  "posts": {
    "twitter": [{ "content": "", "type": "single|thread", "hashtags": [], "bestTime": "" }],
    "linkedin": [{ "content": "", "hashtags": [], "bestTime": "" }],
    "instagram": [{ "caption": "", "hashtags": [], "type": "post|story|reel", "visualIdea": "" }]
  }
}` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { posts: response.content }; }
  }

  private async findTrends(niche: string): Promise<any> {
    const results = await webSearch(`${niche} trending today ${new Date().getFullYear()}`, this.searchConfig, 10);
    const messages: LLMMessage[] = [
      { role: "system", content: `Identify trending topics for social media content. Output valid JSON.` },
      { role: "user", content: `Find trends in "${niche}":
${results.map(r => `- ${r.title}: ${r.snippet}`).join("\n")}

Return JSON:
{ "niche": "${niche}", "trends": [{ "topic": "", "angle": "", "platforms": [], "urgency": "trending-now|this-week|evergreen" }], "hotTopics": [], "contentIdeas": [] }` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { hotTopics: [], trends: [] }; }
  }

  private async engagementReplies(input: any): Promise<any> {
    const messages: LLMMessage[] = [
      { role: "system", content: `Generate engaging, authentic reply suggestions. Match the brand voice. Output valid JSON.` },
      { role: "user", content: `Generate replies for these comments:
${input.comments.map((c: string, i: number) => `${i + 1}. "${c}"`).join("\n")}
${input.brandVoice ? `Brand voice: ${input.brandVoice}` : ""}

Return JSON:
{ "replies": [{ "comment": "", "reply": "", "tone": "" }] }` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { replies: [] }; }
  }

  private async hashtagResearch(input: any): Promise<any> {
    const messages: LLMMessage[] = [
      { role: "system", content: `Research optimal hashtags. Mix popular + niche for maximum reach. Output valid JSON.` },
      { role: "user", content: `Hashtag research for: "${input.topic}"
Platform: ${input.platform || "all"}

Return JSON:
{
  "topic": "${input.topic}",
  "hashtags": {
    "highVolume": ["popular, broad reach"],
    "mediumVolume": ["moderate, targeted"],
    "niche": ["specific, engaged audience"],
    "branded": ["brand-specific"]
  },
  "recommended": { "twitter": [], "linkedin": [], "instagram": [] },
  "avoid": ["hashtags to avoid and why"]
}` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { hashtags: {} }; }
  }

  private async postAnalyzer(input: any): Promise<any> {
    const messages: LLMMessage[] = [
      { role: "system", content: `Analyze a social media post and predict performance. Output valid JSON.` },
      { role: "user", content: `Analyze this ${input.platform} post:
"${input.post}"

Return JSON:
{
  "platform": "${input.platform}",
  "score": 0-100,
  "strengths": [],
  "weaknesses": [],
  "predictedEngagement": "high|medium|low",
  "suggestions": [],
  "improvedVersion": ""
}` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { analysis: response.content }; }
  }
}
