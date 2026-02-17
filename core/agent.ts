// Agent — THE standard interface
// Every agent, skill, team, integration — implements this ONE interface.
// A single researcher OR a team of 50 agents — from outside, same interface.

import type { Message } from "./message";

export interface AgentCapability {
  name: string;          // e.g. "research", "write", "publish"
  description: string;   // what it can do
  inputSchema?: Record<string, string>;  // expected input
  outputSchema?: Record<string, string>; // expected output
}

export interface AgentConfig {
  name: string;
  description: string;
  capabilities: AgentCapability[];
  version: string;
}

// THE interface. Everything implements this.
export abstract class BaseAgent {
  readonly name: string;
  readonly description: string;
  readonly capabilities: AgentCapability[];
  readonly version: string;

  constructor(config: AgentConfig) {
    this.name = config.name;
    this.description = config.description;
    this.capabilities = config.capabilities;
    this.version = config.version;
  }

  // THE ONE METHOD — handle a message, return a message
  abstract handle(message: Message): Promise<Message>;

  // Can this agent handle a specific capability?
  canHandle(capability: string): boolean {
    return this.capabilities.some(
      (c) => c.name === capability || c.description.toLowerCase().includes(capability.toLowerCase())
    );
  }

  // Get agent info as a summary string (for LLM context)
  describe(): string {
    const caps = this.capabilities.map((c) => `  - ${c.name}: ${c.description}`).join("\n");
    return `[${this.name}] ${this.description}\nCapabilities:\n${caps}`;
  }
}
