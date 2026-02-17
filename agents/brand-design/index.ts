// Brand & Design Agent — brand strategy, voice, guidelines, monitoring

import { BaseAgent } from "../../core/agent";
import { createMessage, type Message, type TaskPayload, type ResultPayload } from "../../core/message";
import { LLM, type LLMMessage } from "../../core/llm";
import type { Memory } from "../../core/memory";
import { webSearch, type SearchConfig } from "../researcher/tools/web-search";

export class BrandDesignAgent extends BaseAgent {
  private llm: LLM;
  private memory: Memory;
  private searchConfig: SearchConfig;

  constructor(llm: LLM, memory: Memory, searchConfig: SearchConfig) {
    super({
      name: "brand-design",
      description: "Brand strategy — guidelines, voice design, taglines, positioning, brand monitoring",
      version: "1.0.0",
      capabilities: [
        { name: "brand-guidelines", description: "Create comprehensive brand guidelines", inputSchema: { company: "string", industry: "string?", values: "string[]?" }, outputSchema: { guidelines: "object" } },
        { name: "voice-design", description: "Design brand voice and tone", inputSchema: { company: "string", audience: "string?", competitors: "string[]?" }, outputSchema: { voice: "object" } },
        { name: "tagline-generator", description: "Generate taglines and slogans", inputSchema: { company: "string", product: "string?", count: "number?" }, outputSchema: { taglines: "object[]" } },
        { name: "positioning", description: "Create brand positioning statement", inputSchema: { company: "string", market: "string", competitors: "string[]?" }, outputSchema: { positioning: "object" } },
        { name: "brand-audit", description: "Audit brand consistency", inputSchema: { company: "string", urls: "string[]?" }, outputSchema: { audit: "object" } },
        { name: "naming", description: "Generate brand/product name ideas", inputSchema: { description: "string", style: "string?", count: "number?" }, outputSchema: { names: "object[]" } },
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
        case "brand-guidelines": output = await this.brandGuidelines(task.input); break;
        case "voice-design": output = await this.voiceDesign(task.input); break;
        case "tagline-generator": output = await this.taglineGenerator(task.input); break;
        case "positioning": output = await this.positioning(task.input); break;
        case "brand-audit": output = await this.brandAudit(task.input); break;
        case "naming": output = await this.naming(task.input); break;
        default: output = await this.brandGuidelines(task.input);
      }
      return createMessage(this.name, message.from, "result", { success: true, output } satisfies ResultPayload, message.id);
    } catch (err: any) {
      return createMessage(this.name, message.from, "error", { code: "BRAND_ERROR", message: err.message, retryable: true }, message.id);
    }
  }

  private async brandGuidelines(input: any): Promise<any> {
    const messages: LLMMessage[] = [
      { role: "system", content: `You are a brand strategist. Create comprehensive brand guidelines. Output valid JSON.` },
      { role: "user", content: `Create brand guidelines for: ${input.company}
${input.industry ? `Industry: ${input.industry}` : ""}
${input.values ? `Values: ${input.values.join(", ")}` : ""}

Return JSON:
{
  "company": "${input.company}",
  "mission": "",
  "vision": "",
  "values": [],
  "voice": { "personality": "", "tone": "", "style": "" },
  "messaging": { "tagline": "", "elevator": "", "boilerplate": "" },
  "visual": { "colorPalette": { "primary": "", "secondary": "", "accent": "" }, "typography": { "headings": "", "body": "" }, "imagery": "" },
  "dos": [],
  "donts": [],
  "examples": { "good": [], "bad": [] }
}` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { guidelines: response.content }; }
  }

  private async voiceDesign(input: any): Promise<any> {
    const messages: LLMMessage[] = [
      { role: "system", content: `Design a distinctive brand voice. Output valid JSON.` },
      { role: "user", content: `Design brand voice for: ${input.company}
${input.audience ? `Audience: ${input.audience}` : ""}
${input.competitors ? `Competitors: ${input.competitors.join(", ")}` : ""}

Return JSON:
{
  "voiceAttributes": [{ "attribute": "", "description": "", "example": "" }],
  "toneSpectrum": { "formal_casual": 0-10, "serious_playful": 0-10, "respectful_irreverent": 0-10, "matter_of_fact_enthusiastic": 0-10 },
  "vocabulary": { "use": [], "avoid": [] },
  "writingRules": [],
  "examples": { "socialMedia": "", "email": "", "website": "", "support": "" }
}` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { voice: response.content }; }
  }

  private async taglineGenerator(input: any): Promise<any> {
    const count = input.count || 10;
    const messages: LLMMessage[] = [
      { role: "system", content: `Generate memorable, distinctive taglines. Output valid JSON.` },
      { role: "user", content: `Generate ${count} taglines:
Company: ${input.company}
${input.product ? `Product: ${input.product}` : ""}

Return JSON:
{
  "taglines": [
    { "tagline": "", "style": "benefit|emotional|clever|aspirational|descriptive", "reasoning": "" }
  ],
  "topPick": { "tagline": "", "why": "" }
}` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { taglines: response.content }; }
  }

  private async positioning(input: any): Promise<any> {
    let competitorContext = "";
    if (input.competitors?.length) {
      for (const c of input.competitors.slice(0, 3)) {
        const results = await webSearch(`${c} positioning tagline`, this.searchConfig, 3);
        competitorContext += `${c}: ${results.map(r => r.snippet).join(" | ")}\n`;
      }
    }
    const messages: LLMMessage[] = [
      { role: "system", content: `Create a strategic brand positioning. Output valid JSON.` },
      { role: "user", content: `Brand positioning for: ${input.company}
Market: ${input.market}
${competitorContext ? `Competitors:\n${competitorContext}` : ""}

Return JSON:
{
  "positioningStatement": "For [target], [company] is the [category] that [benefit] because [reason]",
  "targetAudience": { "primary": "", "secondary": "" },
  "uniqueValue": "",
  "competitiveDifferentiators": [],
  "marketPosition": { "quadrant": "", "explanation": "" },
  "messagingPillars": [{ "pillar": "", "proofPoints": [] }],
  "elevator": ""
}` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { positioning: response.content }; }
  }

  private async brandAudit(input: any): Promise<any> {
    const results = await webSearch(`"${input.company}" brand`, this.searchConfig, 10);
    const messages: LLMMessage[] = [
      { role: "system", content: `Audit brand consistency and perception. Output valid JSON.` },
      { role: "user", content: `Brand audit for: ${input.company}

Online presence:
${results.map(r => `- ${r.title}: ${r.snippet}`).join("\n")}

Return JSON:
{
  "company": "${input.company}",
  "overallScore": 0-100,
  "consistency": { "visual": 0-100, "voice": 0-100, "messaging": 0-100 },
  "strengths": [],
  "weaknesses": [],
  "perception": "",
  "recommendations": [{ "priority": "high|medium|low", "action": "" }]
}` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { audit: response.content }; }
  }

  private async naming(input: any): Promise<any> {
    const count = input.count || 15;
    const messages: LLMMessage[] = [
      { role: "system", content: `Generate creative brand/product names. Check they're memorable, unique, and domain-friendly. Output valid JSON.` },
      { role: "user", content: `Generate ${count} name ideas:
Description: ${input.description}
${input.style ? `Style: ${input.style}` : ""}

Return JSON:
{
  "names": [
    { "name": "", "style": "compound|invented|metaphor|acronym|descriptive", "available": "check .com", "reasoning": "" }
  ],
  "topPicks": [],
  "namingStrategy": ""
}` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { names: response.content }; }
  }
}
