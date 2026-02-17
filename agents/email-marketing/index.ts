// Email Marketing Agent — sequences, newsletters, drip campaigns, A/B testing

import { BaseAgent } from "../../core/agent";
import { createMessage, type Message, type TaskPayload, type ResultPayload } from "../../core/message";
import { LLM, type LLMMessage } from "../../core/llm";
import type { Memory } from "../../core/memory";

export class EmailMarketingAgent extends BaseAgent {
  private llm: LLM;
  private memory: Memory;

  constructor(llm: LLM, memory: Memory) {
    super({
      name: "email-marketing",
      description: "Creates email campaigns — welcome sequences, newsletters, drip campaigns, A/B subject lines",
      version: "1.0.0",
      capabilities: [
        { name: "write-sequence", description: "Create a multi-email sequence (welcome, onboarding, nurture)", inputSchema: { goal: "string", emails: "number?", audience: "string?" }, outputSchema: { sequence: "object[]" } },
        { name: "write-newsletter", description: "Write a newsletter email", inputSchema: { topic: "string", updates: "string?", tone: "string?" }, outputSchema: { email: "object" } },
        { name: "write-drip", description: "Create a drip campaign for conversion", inputSchema: { goal: "string", stages: "number?", trigger: "string?" }, outputSchema: { drip: "object[]" } },
        { name: "ab-subject-lines", description: "Generate A/B test subject line variants", inputSchema: { topic: "string", count: "number?" }, outputSchema: { variants: "object[]" } },
        { name: "write-cold-email", description: "Write a cold outreach email", inputSchema: { target: "string", offer: "string", context: "string?" }, outputSchema: { email: "object" } },
      ],
    });
    this.llm = llm;
    this.memory = memory;
  }

  async handle(message: Message): Promise<Message> {
    const task = message.payload as TaskPayload;
    try {
      let output: any;
      switch (task.action) {
        case "write-sequence": output = await this.writeSequence(task.input); break;
        case "write-newsletter": output = await this.writeNewsletter(task.input); break;
        case "write-drip": output = await this.writeDrip(task.input); break;
        case "ab-subject-lines": output = await this.abSubjectLines(task.input); break;
        case "write-cold-email": output = await this.writeColdEmail(task.input); break;
        default: output = await this.writeSequence(task.input);
      }
      return createMessage(this.name, message.from, "result", { success: true, output } satisfies ResultPayload, message.id);
    } catch (err: any) {
      return createMessage(this.name, message.from, "error", { code: "EMAIL_ERROR", message: err.message, retryable: true }, message.id);
    }
  }

  private async writeSequence(input: any): Promise<any> {
    const numEmails = input.emails || 5;
    const messages: LLMMessage[] = [
      { role: "system", content: `You are an email marketing expert. Create high-converting email sequences. Output valid JSON.` },
      { role: "user", content: `Create a ${numEmails}-email sequence:
Goal: ${input.goal}
${input.audience ? `Audience: ${input.audience}` : ""}
${input.brandGuidelines ? `Brand: ${input.brandGuidelines}` : ""}

Return JSON:
{
  "name": "sequence name",
  "goal": "${input.goal}",
  "totalEmails": ${numEmails},
  "emails": [
    {
      "number": 1,
      "delay": "immediately|1 day|3 days|etc",
      "subject": "",
      "preheader": "",
      "body": "full email in HTML-friendly format",
      "cta": { "text": "", "url": "{{CTA_URL}}" },
      "purpose": "what this email achieves"
    }
  ],
  "tips": ["optimization tips"]
}` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { content: response.content }; }
  }

  private async writeNewsletter(input: any): Promise<any> {
    const messages: LLMMessage[] = [
      { role: "system", content: `You are a newsletter writer. Create engaging, well-structured newsletters. Output valid JSON.` },
      { role: "user", content: `Write a newsletter:
Topic: ${input.topic}
${input.updates ? `Updates to include: ${input.updates}` : ""}
Tone: ${input.tone || "professional yet friendly"}

Return JSON:
{
  "subject": "",
  "preheader": "",
  "sections": [
    { "heading": "", "content": "", "cta": "" }
  ],
  "fullHtml": "complete email body",
  "plainText": "plain text version"
}` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { content: response.content }; }
  }

  private async writeDrip(input: any): Promise<any> {
    const stages = input.stages || 4;
    const messages: LLMMessage[] = [
      { role: "system", content: `You are a conversion optimization expert. Create drip campaigns that guide users toward conversion. Output valid JSON.` },
      { role: "user", content: `Create a ${stages}-stage drip campaign:
Goal: ${input.goal}
${input.trigger ? `Trigger: ${input.trigger}` : ""}

Return JSON:
{
  "name": "",
  "trigger": "${input.trigger || "user signs up"}",
  "goal": "${input.goal}",
  "stages": [
    {
      "stage": 1,
      "name": "awareness|consideration|decision|action",
      "delay": "0|1 day|3 days|etc",
      "subject": "",
      "body": "",
      "cta": "",
      "exitCondition": "what makes them leave this stage"
    }
  ],
  "expectedConversion": "",
  "tips": []
}` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { content: response.content }; }
  }

  private async abSubjectLines(input: any): Promise<any> {
    const count = input.count || 5;
    const messages: LLMMessage[] = [
      { role: "system", content: `You are an email subject line specialist. Generate high-open-rate subject lines using proven techniques. Output valid JSON.` },
      { role: "user", content: `Generate ${count} A/B test subject line variants:
Topic: ${input.topic}

Return JSON:
{
  "topic": "${input.topic}",
  "variants": [
    {
      "subject": "",
      "technique": "curiosity|urgency|benefit|question|number|personalization|emoji",
      "preheader": "",
      "predictedOpenRate": "high|medium|low",
      "reasoning": "why this might work"
    }
  ],
  "recommendation": "which to test first and why"
}` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { content: response.content }; }
  }

  private async writeColdEmail(input: any): Promise<any> {
    const messages: LLMMessage[] = [
      { role: "system", content: `You are a cold email expert. Write concise, personalized cold emails that get replies. Output valid JSON.` },
      { role: "user", content: `Write a cold outreach email:
Target: ${input.target}
Offer: ${input.offer}
${input.context ? `Context: ${input.context}` : ""}

Return JSON:
{
  "subject": "",
  "body": "",
  "followUp1": { "delay": "3 days", "subject": "", "body": "" },
  "followUp2": { "delay": "7 days", "subject": "", "body": "" },
  "tips": ["personalization suggestions"]
}` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { content: response.content }; }
  }
}
