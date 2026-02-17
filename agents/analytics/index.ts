// Analytics Agent — tracks content and campaign performance

import { BaseAgent } from "../../core/agent";
import { createMessage, type Message, type TaskPayload, type ResultPayload } from "../../core/message";
import type { Memory } from "../../core/memory";

export class AnalyticsAgent extends BaseAgent {
  private memory: Memory;

  constructor(memory: Memory) {
    super({
      name: "analytics",
      description: "Tracks content performance, campaign metrics, and provides insights",
      version: "2.0.0",
      capabilities: [
        {
          name: "track",
          description: "Track a content or campaign metric",
          inputSchema: { type: "string", data: "object" },
          outputSchema: { tracked: "boolean" },
        },
        {
          name: "report",
          description: "Generate a performance report",
          inputSchema: { period: "string?", type: "string?" },
          outputSchema: { report: "object" },
        },
      ],
    });
    this.memory = memory;
  }

  async handle(message: Message): Promise<Message> {
    const task = message.payload as TaskPayload;

    try {
      let output: any;

      switch (task.action) {
        case "track":
          await this.memory.set(
            `metric:${Date.now()}`,
            task.input.data || task.input,
            "analytics",
            ["metric", task.input.type || "general"],
          );
          output = { tracked: true };
          break;
        case "report":
          const metrics = this.memory.byAgent("analytics");
          output = {
            totalMetrics: metrics.length,
            recent: metrics.slice(-20),
            period: task.input.period || "all",
          };
          break;
        default:
          output = { message: "Use track or report actions" };
      }

      return createMessage(this.name, message.from, "result", {
        success: true,
        output,
      } satisfies ResultPayload, message.id);
    } catch (err: any) {
      return createMessage(this.name, message.from, "error", {
        code: "ANALYTICS_ERROR",
        message: err.message,
        retryable: false,
      }, message.id);
    }
  }
}
