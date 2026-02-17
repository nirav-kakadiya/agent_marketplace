// Data Analyst Agent — analyze data, find patterns, generate reports

import { BaseAgent } from "../../core/agent";
import { createMessage, type Message, type TaskPayload, type ResultPayload } from "../../core/message";
import { LLM, type LLMMessage } from "../../core/llm";

export class DataAnalystAgent extends BaseAgent {
  private llm: LLM;

  constructor(llm: LLM) {
    super({
      name: "data-analyst",
      description: "Data analysis — CSV/JSON analysis, pattern finding, report generation, metric comparison, forecasting",
      version: "1.0.0",
      capabilities: [
        { name: "analyze-data", description: "Analyze structured data (CSV/JSON) and find insights", inputSchema: { data: "string", question: "string?" }, outputSchema: { analysis: "object" } },
        { name: "compare-metrics", description: "Compare metrics across periods", inputSchema: { current: "object", previous: "object", metrics: "string[]?" }, outputSchema: { comparison: "object" } },
        { name: "generate-report", description: "Generate a narrative report from data", inputSchema: { data: "string", reportType: "string?", audience: "string?" }, outputSchema: { report: "object" } },
        { name: "find-anomalies", description: "Find anomalies and outliers in data", inputSchema: { data: "string" }, outputSchema: { anomalies: "object[]" } },
        { name: "forecast", description: "Predict trends from historical data", inputSchema: { data: "string", periods: "number?" }, outputSchema: { forecast: "object" } },
        { name: "summarize-metrics", description: "Summarize key metrics for a dashboard", inputSchema: { data: "string", metrics: "string[]?" }, outputSchema: { summary: "object" } },
      ],
    });
    this.llm = llm;
  }

  async handle(message: Message): Promise<Message> {
    const task = message.payload as TaskPayload;
    try {
      let output: any;
      switch (task.action) {
        case "analyze-data": output = await this.analyzeData(task.input); break;
        case "compare-metrics": output = await this.compareMetrics(task.input); break;
        case "generate-report": output = await this.generateReport(task.input); break;
        case "find-anomalies": output = await this.findAnomalies(task.input.data); break;
        case "forecast": output = await this.forecast(task.input); break;
        case "summarize-metrics": output = await this.summarizeMetrics(task.input); break;
        default: output = await this.analyzeData(task.input);
      }
      return createMessage(this.name, message.from, "result", { success: true, output } satisfies ResultPayload, message.id);
    } catch (err: any) {
      return createMessage(this.name, message.from, "error", { code: "DATA_ERROR", message: err.message, retryable: true }, message.id);
    }
  }

  private async analyzeData(input: any): Promise<any> {
    const messages: LLMMessage[] = [
      { role: "system", content: `You are a data analyst. Analyze the data, find patterns, and provide actionable insights. Output valid JSON.` },
      { role: "user", content: `Analyze this data:
${typeof input.data === "string" ? input.data.slice(0, 10000) : JSON.stringify(input.data).slice(0, 10000)}

${input.question ? `Specific question: ${input.question}` : "Find the most important insights."}

Return JSON:
{
  "summary": "",
  "keyMetrics": [{ "metric": "", "value": "", "trend": "up|down|stable" }],
  "patterns": [],
  "insights": [{ "finding": "", "significance": "high|medium|low", "recommendation": "" }],
  "visualizations": [{ "type": "bar|line|pie|table", "title": "", "data": {} }]
}` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { analysis: response.content }; }
  }

  private async compareMetrics(input: any): Promise<any> {
    const messages: LLMMessage[] = [
      { role: "system", content: `Compare metrics across periods and highlight significant changes. Output valid JSON.` },
      { role: "user", content: `Compare metrics:
Current: ${JSON.stringify(input.current)}
Previous: ${JSON.stringify(input.previous)}
${input.metrics ? `Focus on: ${input.metrics.join(", ")}` : ""}

Return JSON:
{
  "comparison": [{ "metric": "", "current": 0, "previous": 0, "change": 0, "changePercent": "", "trend": "up|down|stable", "significance": "high|medium|low" }],
  "highlights": [],
  "concerns": [],
  "recommendations": []
}` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { comparison: response.content }; }
  }

  private async generateReport(input: any): Promise<any> {
    const messages: LLMMessage[] = [
      { role: "system", content: `Generate a professional narrative report from data. Make it readable for ${input.audience || "business stakeholders"}. Output valid JSON.` },
      { role: "user", content: `Generate a ${input.reportType || "performance"} report:
${typeof input.data === "string" ? input.data.slice(0, 8000) : JSON.stringify(input.data).slice(0, 8000)}

Return JSON:
{
  "title": "",
  "executiveSummary": "",
  "sections": [{ "heading": "", "content": "", "metrics": [] }],
  "keyTakeaways": [],
  "recommendations": [],
  "nextSteps": []
}` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { report: response.content }; }
  }

  private async findAnomalies(data: string): Promise<any> {
    const messages: LLMMessage[] = [
      { role: "system", content: `Find anomalies, outliers, and unexpected patterns in data. Output valid JSON.` },
      { role: "user", content: `Find anomalies:\n${typeof data === "string" ? data.slice(0, 8000) : JSON.stringify(data).slice(0, 8000)}\n\nReturn JSON:\n{ "anomalies": [{ "description": "", "severity": "critical|warning|info", "value": "", "expected": "", "possibleCause": "" }], "summary": "" }` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { anomalies: response.content }; }
  }

  private async forecast(input: any): Promise<any> {
    const periods = input.periods || 3;
    const messages: LLMMessage[] = [
      { role: "system", content: `Forecast trends from historical data. Be transparent about confidence levels. Output valid JSON.` },
      { role: "user", content: `Forecast ${periods} periods ahead:
${typeof input.data === "string" ? input.data.slice(0, 8000) : JSON.stringify(input.data).slice(0, 8000)}

Return JSON:
{
  "historicalTrend": "",
  "forecast": [{ "period": "", "predicted": "", "confidence": "high|medium|low", "range": { "low": "", "high": "" } }],
  "assumptions": [],
  "risks": [],
  "methodology": ""
}` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { forecast: response.content }; }
  }

  private async summarizeMetrics(input: any): Promise<any> {
    const messages: LLMMessage[] = [
      { role: "system", content: `Summarize key metrics into a dashboard-ready format. Output valid JSON.` },
      { role: "user", content: `Summarize metrics:
${typeof input.data === "string" ? input.data.slice(0, 8000) : JSON.stringify(input.data).slice(0, 8000)}
${input.metrics ? `Focus: ${input.metrics.join(", ")}` : ""}

Return JSON:
{
  "cards": [{ "label": "", "value": "", "change": "", "trend": "up|down|stable", "icon": "" }],
  "highlights": [],
  "alerts": []
}` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { summary: response.content }; }
  }
}
