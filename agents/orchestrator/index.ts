// Orchestrator Agent — routes requests to the right agent or campaign
// Smart enough to know when to use a single agent vs create a full campaign

import { BaseAgent } from "../../core/agent";
import { createMessage, type Message, type TaskPayload, type ResultPayload } from "../../core/message";
import { MessageBus } from "../../core/bus";
import { LLM, type LLMMessage } from "../../core/llm";
import type { Memory } from "../../core/memory";

export class OrchestratorAgent extends BaseAgent {
  private llm: LLM;
  private bus: MessageBus;
  private memory: Memory;

  constructor(llm: LLM, bus: MessageBus, memory: Memory) {
    super({
      name: "orchestrator",
      description: "Plans and coordinates tasks — routes to single agents or creates campaigns",
      version: "2.0.0",
      capabilities: [
        {
          name: "orchestrate",
          description: "Break down a request and coordinate agents to complete it",
          inputSchema: { request: "string" },
          outputSchema: { result: "string", steps: "object[]" },
        },
      ],
    });
    this.llm = llm;
    this.bus = bus;
    this.memory = memory;
  }

  async handle(message: Message): Promise<Message> {
    const task = message.payload as TaskPayload;
    const request = task.input.request || task.input.topic || JSON.stringify(task.input);

    try {
      // 1. Determine routing: single agent, multi-agent, or campaign
      const routing = await this.planRouting(request);

      let output: any;

      if (routing.type === "single") {
        // Direct to one agent
        const msg = createMessage("orchestrator", routing.agent, "task", {
          action: routing.action,
          input: { ...task.input, topic: request },
        });
        const result = await this.bus.send(msg);
        output = result.payload;

      } else if (routing.type === "campaign") {
        // Create and run a campaign
        const msg = createMessage("orchestrator", "campaign-manager", "task", {
          action: "create-campaign",
          input: { request, strategy: routing.strategy, ...task.input },
        });
        const createResult = await this.bus.send(msg);

        if (createResult.type === "error") throw new Error(createResult.payload.message);

        const campaignId = createResult.payload.output?.id;
        if (campaignId) {
          // Run the campaign
          const runMsg = createMessage("orchestrator", "campaign-manager", "task", {
            action: "run-campaign",
            input: { campaignId },
          });
          const runResult = await this.bus.send(runMsg);
          output = runResult.payload;
        } else {
          output = createResult.payload;
        }

      } else {
        // Multi-step: sequential agent calls
        const results: any[] = [];
        for (const step of routing.steps) {
          const msg = createMessage("orchestrator", step.agent, "task", {
            action: step.action,
            input: { ...task.input, ...step.input, topic: request },
          });
          const result = await this.bus.send(msg);
          results.push({ agent: step.agent, action: step.action, result: result.payload });
        }
        output = { success: true, output: { steps: results } };
      }

      // Save to memory
      await this.memory.set(
        `task:${Date.now()}`,
        { request, routing: routing.type, timestamp: new Date().toISOString() },
        "orchestrator",
        ["task"],
      );

      return createMessage(this.name, message.from, "result", output, message.id);
    } catch (err: any) {
      return createMessage(this.name, message.from, "error", {
        code: "ORCHESTRATION_ERROR",
        message: err.message,
        retryable: true,
      }, message.id);
    }
  }

  private async planRouting(request: string): Promise<any> {
    const agentDescriptions = this.bus.describeAll();

    const messages: LLMMessage[] = [
      {
        role: "system",
        content: `You are a task router. Given a request, decide how to handle it. Output valid JSON only.

Available agents:
${agentDescriptions}

Routing types:
- "single": Simple task for one agent (e.g., "research AI trends")
- "campaign": Complex multi-step campaign (e.g., "launch my product", "create a content strategy")
- "multi": Sequential steps across agents (e.g., "research and write about X")`,
      },
      {
        role: "user",
        content: `Route this request: "${request}"

Return JSON:
{
  "type": "single|campaign|multi",
  "agent": "agent-name (for single)",
  "action": "agent-action (for single)",
  "strategy": "campaign-strategy (for campaign)",
  "steps": [{"agent": "", "action": "", "input": {}}] // for multi
}`,
      },
    ];

    const response = await this.llm.chat(messages);

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch?.[0] || '{"type":"single","agent":"researcher","action":"research"}');
    } catch {
      return { type: "single", agent: "researcher", action: "research" };
    }
  }
}
