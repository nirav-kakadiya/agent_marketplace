// DevOps Agent — monitoring, deployment management, incident response, log analysis

import { BaseAgent } from "../../core/agent";
import { createMessage, type Message, type TaskPayload, type ResultPayload } from "../../core/message";
import { LLM, type LLMMessage } from "../../core/llm";

export class DevOpsAgent extends BaseAgent {
  private llm: LLM;

  constructor(llm: LLM) {
    super({
      name: "devops-agent",
      description: "DevOps assistance — log analysis, incident post-mortems, deployment checklists, infra optimization, monitoring setup",
      version: "1.0.0",
      capabilities: [
        { name: "analyze-logs", description: "Analyze logs for errors and patterns", inputSchema: { logs: "string", context: "string?" }, outputSchema: { analysis: "object" } },
        { name: "post-mortem", description: "Generate incident post-mortem report", inputSchema: { incident: "string", timeline: "string?", impact: "string?" }, outputSchema: { report: "object" } },
        { name: "deploy-checklist", description: "Create deployment checklist", inputSchema: { service: "string", environment: "string?", changes: "string?" }, outputSchema: { checklist: "object" } },
        { name: "optimize-infra", description: "Suggest infrastructure optimizations", inputSchema: { currentSetup: "string", issues: "string?" }, outputSchema: { recommendations: "object" } },
        { name: "monitoring-setup", description: "Design monitoring and alerting strategy", inputSchema: { services: "string[]", requirements: "string?" }, outputSchema: { strategy: "object" } },
        { name: "debug-help", description: "Help debug an issue with error context", inputSchema: { error: "string", stack: "string?", context: "string?" }, outputSchema: { diagnosis: "object" } },
      ],
    });
    this.llm = llm;
  }

  async handle(message: Message): Promise<Message> {
    const task = message.payload as TaskPayload;
    try {
      let output: any;
      switch (task.action) {
        case "analyze-logs": output = await this.analyzeLogs(task.input); break;
        case "post-mortem": output = await this.postMortem(task.input); break;
        case "deploy-checklist": output = await this.deployChecklist(task.input); break;
        case "optimize-infra": output = await this.optimizeInfra(task.input); break;
        case "monitoring-setup": output = await this.monitoringSetup(task.input); break;
        case "debug-help": output = await this.debugHelp(task.input); break;
        default: output = await this.analyzeLogs(task.input);
      }
      return createMessage(this.name, message.from, "result", { success: true, output } satisfies ResultPayload, message.id);
    } catch (err: any) {
      return createMessage(this.name, message.from, "error", { code: "DEVOPS_ERROR", message: err.message, retryable: true }, message.id);
    }
  }

  private async analyzeLogs(input: any): Promise<any> {
    const messages: LLMMessage[] = [
      { role: "system", content: `Analyze application/server logs. Identify errors, patterns, and root causes. Output valid JSON.` },
      { role: "user", content: `Analyze these logs:
${input.context ? `Context: ${input.context}` : ""}

${input.logs.slice(0, 10000)}

Return JSON:
{
  "summary": "",
  "errors": [{ "type": "", "count": 0, "message": "", "severity": "critical|error|warning|info", "firstSeen": "", "lastSeen": "" }],
  "patterns": [],
  "rootCause": "",
  "recommendations": [{ "priority": "immediate|short-term|long-term", "action": "" }],
  "healthScore": 0-100
}` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { analysis: response.content }; }
  }

  private async postMortem(input: any): Promise<any> {
    const messages: LLMMessage[] = [
      { role: "system", content: `Generate a thorough incident post-mortem following industry best practices (blameless). Output valid JSON.` },
      { role: "user", content: `Generate post-mortem:
Incident: ${input.incident}
${input.timeline ? `Timeline: ${input.timeline}` : ""}
${input.impact ? `Impact: ${input.impact}` : ""}

Return JSON:
{
  "title": "",
  "severity": "P1|P2|P3|P4",
  "duration": "",
  "impact": { "users": "", "revenue": "", "services": [] },
  "summary": "",
  "timeline": [{ "time": "", "event": "" }],
  "rootCause": "",
  "contributing": [],
  "whatWorked": [],
  "whatDidnt": [],
  "actionItems": [{ "action": "", "owner": "", "priority": "P1|P2|P3", "deadline": "" }],
  "lessonsLearned": [],
  "preventionMeasures": []
}` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { report: response.content }; }
  }

  private async deployChecklist(input: any): Promise<any> {
    const messages: LLMMessage[] = [
      { role: "system", content: `Create a comprehensive deployment checklist. Output valid JSON.` },
      { role: "user", content: `Deployment checklist:
Service: ${input.service}
Environment: ${input.environment || "production"}
${input.changes ? `Changes: ${input.changes}` : ""}

Return JSON:
{
  "service": "${input.service}",
  "environment": "${input.environment || "production"}",
  "preDeploy": [{ "step": "", "critical": true }],
  "deploy": [{ "step": "", "command": "", "critical": true }],
  "postDeploy": [{ "step": "", "critical": true }],
  "rollback": { "trigger": "", "steps": [] },
  "monitoring": ["what to watch after deploy"],
  "communication": { "before": "", "during": "", "after": "" }
}` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { checklist: response.content }; }
  }

  private async optimizeInfra(input: any): Promise<any> {
    const messages: LLMMessage[] = [
      { role: "system", content: `Suggest infrastructure optimizations for cost, performance, and reliability. Output valid JSON.` },
      { role: "user", content: `Optimize infrastructure:
Current setup: ${input.currentSetup}
${input.issues ? `Issues: ${input.issues}` : ""}

Return JSON:
{
  "currentAssessment": { "cost": "", "performance": "", "reliability": "", "security": "" },
  "recommendations": [{ "area": "cost|performance|reliability|security|scalability", "current": "", "recommended": "", "impact": "high|medium|low", "effort": "easy|medium|hard", "savings": "" }],
  "quickWins": [],
  "architectureChanges": [],
  "estimatedSavings": ""
}` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { recommendations: response.content }; }
  }

  private async monitoringSetup(input: any): Promise<any> {
    const messages: LLMMessage[] = [
      { role: "system", content: `Design a monitoring and alerting strategy. Output valid JSON.` },
      { role: "user", content: `Design monitoring for: ${input.services.join(", ")}
${input.requirements ? `Requirements: ${input.requirements}` : ""}

Return JSON:
{
  "services": ${JSON.stringify(input.services)},
  "metrics": [{ "service": "", "metric": "", "type": "gauge|counter|histogram", "alertThreshold": "", "severity": "" }],
  "dashboards": [{ "name": "", "panels": [] }],
  "alertRules": [{ "name": "", "condition": "", "severity": "critical|warning|info", "channel": "slack|email|pager" }],
  "tools": { "recommended": [], "alternatives": [] },
  "slos": [{ "service": "", "sli": "", "target": "" }]
}` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { strategy: response.content }; }
  }

  private async debugHelp(input: any): Promise<any> {
    const messages: LLMMessage[] = [
      { role: "system", content: `Help diagnose and fix technical issues. Provide specific, actionable solutions. Output valid JSON.` },
      { role: "user", content: `Debug this issue:
Error: ${input.error}
${input.stack ? `Stack trace:\n${input.stack}` : ""}
${input.context ? `Context: ${input.context}` : ""}

Return JSON:
{
  "diagnosis": "",
  "rootCause": "",
  "solutions": [{ "approach": "", "steps": [], "confidence": "high|medium|low" }],
  "quickFix": "",
  "preventionTips": []
}` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { diagnosis: response.content }; }
  }
}
