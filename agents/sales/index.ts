// Sales Agent — lead generation, outreach, follow-ups, prospect research

import { BaseAgent } from "../../core/agent";
import { createMessage, type Message, type TaskPayload, type ResultPayload } from "../../core/message";
import { LLM, type LLMMessage } from "../../core/llm";
import type { Memory } from "../../core/memory";
import { webSearch, type SearchConfig } from "../researcher/tools/web-search";
import { scrapePage } from "../researcher/tools/web-scraper";

export class SalesAgent extends BaseAgent {
  private llm: LLM;
  private memory: Memory;
  private searchConfig: SearchConfig;

  constructor(llm: LLM, memory: Memory, searchConfig: SearchConfig) {
    super({
      name: "sales-agent",
      description: "Lead generation, cold outreach, follow-ups, prospect research, pipeline analysis",
      version: "1.0.0",
      capabilities: [
        { name: "find-leads", description: "Find potential leads/companies in a niche", inputSchema: { niche: "string", count: "number?", criteria: "string?" }, outputSchema: { leads: "object[]" } },
        { name: "research-prospect", description: "Deep research on a prospect/company", inputSchema: { company: "string", url: "string?" }, outputSchema: { profile: "object" } },
        { name: "write-outreach", description: "Write personalized cold outreach", inputSchema: { prospect: "string", offer: "string", channel: "string?" }, outputSchema: { messages: "object" } },
        { name: "follow-up-sequence", description: "Create follow-up email sequence", inputSchema: { context: "string", touchpoints: "number?" }, outputSchema: { sequence: "object[]" } },
        { name: "meeting-prep", description: "Prepare briefing for a sales meeting", inputSchema: { company: "string", url: "string?", agenda: "string?" }, outputSchema: { briefing: "object" } },
        { name: "objection-handler", description: "Generate responses to common objections", inputSchema: { product: "string", objections: "string[]?" }, outputSchema: { responses: "object[]" } },
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
        case "find-leads": output = await this.findLeads(task.input); break;
        case "research-prospect": output = await this.researchProspect(task.input); break;
        case "write-outreach": output = await this.writeOutreach(task.input); break;
        case "follow-up-sequence": output = await this.followUpSequence(task.input); break;
        case "meeting-prep": output = await this.meetingPrep(task.input); break;
        case "objection-handler": output = await this.objectionHandler(task.input); break;
        default: output = await this.findLeads(task.input);
      }
      return createMessage(this.name, message.from, "result", { success: true, output } satisfies ResultPayload, message.id);
    } catch (err: any) {
      return createMessage(this.name, message.from, "error", { code: "SALES_ERROR", message: err.message, retryable: true }, message.id);
    }
  }

  private async findLeads(input: any): Promise<any> {
    const count = input.count || 10;
    const queries = [
      `${input.niche} companies list ${new Date().getFullYear()}`,
      `best ${input.niche} startups`,
      `${input.niche} ${input.criteria || "growing companies"}`,
    ];
    const allResults: any[] = [];
    for (const q of queries) {
      const results = await webSearch(q, this.searchConfig, 10);
      allResults.push(...results);
    }

    const messages: LLMMessage[] = [
      { role: "system", content: `You are a lead generation specialist. Identify and qualify potential leads from search results. Output valid JSON.` },
      { role: "user", content: `Find ${count} leads in "${input.niche}":
${input.criteria ? `Criteria: ${input.criteria}` : ""}

Search results:
${allResults.slice(0, 20).map(r => `- ${r.title} (${r.url}): ${r.snippet}`).join("\n")}

Return JSON:
{
  "leads": [
    { "company": "", "url": "", "description": "", "size": "startup|smb|enterprise", "relevance": "high|medium|low", "contactApproach": "" }
  ],
  "totalFound": 0,
  "searchStrategy": ""
}` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { leads: [], strategy: response.content }; }
  }

  private async researchProspect(input: any): Promise<any> {
    let pageContent = "";
    if (input.url) {
      try {
        const page = await scrapePage(input.url, 10000);
        pageContent = `\nWebsite content:\nTitle: ${page.title}\nHeadings: ${page.headings.join(", ")}\nContent: ${page.content.slice(0, 3000)}`;
      } catch {}
    }
    const results = await webSearch(`${input.company} company`, this.searchConfig, 5);

    const messages: LLMMessage[] = [
      { role: "system", content: `You are a sales intelligence analyst. Create comprehensive prospect profiles. Output valid JSON.` },
      { role: "user", content: `Research: ${input.company}
${pageContent}

Web results:
${results.map(r => `- ${r.title}: ${r.snippet}`).join("\n")}

Return JSON:
{
  "company": "${input.company}",
  "summary": "",
  "industry": "",
  "size": "",
  "products": [],
  "recentNews": [],
  "painPoints": [],
  "decisionMakers": [],
  "competitors": [],
  "talkingPoints": [],
  "iceBreakers": [],
  "bestApproach": ""
}` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { summary: response.content }; }
  }

  private async writeOutreach(input: any): Promise<any> {
    const messages: LLMMessage[] = [
      { role: "system", content: `Write personalized, high-converting outreach messages. Short, value-first, no fluff. Output valid JSON.` },
      { role: "user", content: `Write outreach to: ${input.prospect}
Offer: ${input.offer}
Channel: ${input.channel || "email + linkedin"}

Return JSON:
{
  "email": { "subject": "", "body": "" },
  "linkedin": { "connectionNote": "", "followUpMessage": "" },
  "twitter": { "dm": "" },
  "personalizationTips": []
}` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { content: response.content }; }
  }

  private async followUpSequence(input: any): Promise<any> {
    const touchpoints = input.touchpoints || 4;
    const messages: LLMMessage[] = [
      { role: "system", content: `Create a follow-up sequence that's persistent but not pushy. Each touchpoint adds new value. Output valid JSON.` },
      { role: "user", content: `Create ${touchpoints}-touch follow-up:
Context: ${input.context}

Return JSON:
{
  "sequence": [
    { "touchpoint": 1, "delay": "3 days", "channel": "email", "subject": "", "body": "", "valueProp": "new value added" }
  ],
  "breakupEmail": { "subject": "", "body": "" },
  "tips": []
}` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { sequence: response.content }; }
  }

  private async meetingPrep(input: any): Promise<any> {
    const profile = await this.researchProspect(input);
    const messages: LLMMessage[] = [
      { role: "system", content: `Create a sales meeting briefing document. Output valid JSON.` },
      { role: "user", content: `Prepare meeting brief:
Company: ${input.company}
${input.agenda ? `Agenda: ${input.agenda}` : ""}

Research:
${JSON.stringify(profile).slice(0, 3000)}

Return JSON:
{
  "company": "${input.company}",
  "keyFacts": [],
  "talkingPoints": [],
  "questionsToAsk": [],
  "objectionsToExpect": [],
  "proposedAgenda": [],
  "closingStrategy": "",
  "nextSteps": []
}` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { briefing: response.content }; }
  }

  private async objectionHandler(input: any): Promise<any> {
    const messages: LLMMessage[] = [
      { role: "system", content: `Generate objection handling responses using proven frameworks (feel-felt-found, boomerang, etc). Output valid JSON.` },
      { role: "user", content: `Product: ${input.product}
${input.objections ? `Specific objections: ${input.objections.join(", ")}` : "Generate common objections and responses"}

Return JSON:
{
  "product": "${input.product}",
  "objections": [
    { "objection": "", "category": "price|timing|need|trust|competition", "response": "", "framework": "", "followUp": "" }
  ]
}` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { objections: response.content }; }
  }
}
