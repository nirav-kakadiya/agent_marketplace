// Message Bus — THE routing layer
// Agents don't know about each other. They send messages to the bus.
// Bus routes messages to the right agent.

import type { BaseAgent } from "./agent";
import { createMessage, type Message, type ResultPayload, type ErrorPayload } from "./message";

export type MessageHandler = (message: Message) => void;
export type Middleware = (message: Message, next: () => Promise<Message>) => Promise<Message>;

export class MessageBus {
  private agents: Map<string, BaseAgent> = new Map();
  private middlewares: Middleware[] = [];
  private eventListeners: Map<string, MessageHandler[]> = new Map();
  private messageLog: Message[] = [];
  private logEnabled: boolean = true;

  // Register an agent on the bus
  register(agent: BaseAgent): void {
    this.agents.set(agent.name, agent);
    console.log(`🔌 Agent registered: ${agent.name} (${agent.capabilities.map(c => c.name).join(", ")})`);
  }

  // Unregister an agent
  unregister(name: string): void {
    this.agents.delete(name);
    console.log(`🔌 Agent removed: ${name}`);
  }

  // Add middleware (logging, rate limiting, etc.)
  use(middleware: Middleware): void {
    this.middlewares.push(middleware);
  }

  // Send a message to a specific agent
  async send(message: Message): Promise<Message> {
    if (this.logEnabled) this.messageLog.push(message);

    // Broadcast
    if (message.to === "*") {
      return this.broadcast(message);
    }

    const agent = this.agents.get(message.to);
    if (!agent) {
      return createMessage(
        "bus",
        message.from,
        "error",
        {
          code: "AGENT_NOT_FOUND",
          message: `No agent named "${message.to}". Available: ${this.listAgentNames().join(", ")}`,
          retryable: false,
        } satisfies ErrorPayload,
        message.id
      );
    }

    // Run through middleware chain
    const execute = async () => agent.handle(message);
    let handler = execute;

    for (const mw of [...this.middlewares].reverse()) {
      const next = handler;
      handler = async () => mw(message, next);
    }

    try {
      const response = await handler();
      if (this.logEnabled) this.messageLog.push(response);
      return response;
    } catch (err: any) {
      const errorMsg = createMessage(
        message.to,
        message.from,
        "error",
        {
          code: "EXECUTION_ERROR",
          message: err.message,
          retryable: true,
        } satisfies ErrorPayload,
        message.id
      );
      if (this.logEnabled) this.messageLog.push(errorMsg);
      return errorMsg;
    }
  }

  // Broadcast to all agents
  private async broadcast(message: Message): Promise<Message> {
    const results: any[] = [];
    for (const [name, agent] of this.agents) {
      if (name === message.from) continue; // don't send to self
      try {
        const response = await agent.handle(message);
        results.push({ agent: name, response: response.payload });
      } catch (err: any) {
        results.push({ agent: name, error: err.message });
      }
    }
    return createMessage("bus", message.from, "result", { results }, message.id);
  }

  // Discover: find agents that can handle a capability
  discover(capability: string): BaseAgent[] {
    return Array.from(this.agents.values()).filter((a) => a.canHandle(capability));
  }

  // List all registered agent names
  listAgentNames(): string[] {
    return Array.from(this.agents.keys());
  }

  // Get agent by name
  getAgent(name: string): BaseAgent | undefined {
    return this.agents.get(name);
  }

  // Get all agents
  getAllAgents(): BaseAgent[] {
    return Array.from(this.agents.values());
  }

  // Get all agents' descriptions (for LLM context)
  describeAll(): string {
    return Array.from(this.agents.values())
      .map((a) => a.describe())
      .join("\n\n");
  }

  // Get message log
  getLog(limit?: number): Message[] {
    return limit ? this.messageLog.slice(-limit) : this.messageLog;
  }

  // Event system for pub/sub
  on(event: string, handler: MessageHandler): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(handler);
  }

  emit(event: string, message: Message): void {
    const handlers = this.eventListeners.get(event) || [];
    for (const handler of handlers) {
      handler(message);
    }
  }
}
