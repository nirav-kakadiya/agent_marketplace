// Publisher Agent — publishes content to platforms (WordPress, Twitter, etc.)
// Uses self-built integrations from the integrations/ folder

import { BaseAgent } from "../../core/agent";
import { createMessage, type Message, type TaskPayload, type ResultPayload } from "../../core/message";
import { Executor } from "../../core/executor";
import { readdir, readFile } from "fs/promises";
import { join } from "path";

interface Integration {
  name: string;
  description: string;
  code: string;
  requirements: { name: string; description: string; type: string; required: boolean }[];
}

export class PublisherAgent extends BaseAgent {
  private executor: Executor;
  private integrationsDir: string;
  private integrations: Map<string, Integration> = new Map();

  constructor(executor: Executor, integrationsDir: string) {
    super({
      name: "publisher",
      description: "Publishes content to platforms using self-built integrations",
      version: "1.0.0",
      capabilities: [
        {
          name: "publish",
          description: "Publish content to a platform (WordPress, Twitter, LinkedIn, etc.)",
          inputSchema: { platform: "string", content: "string", title: "string?" },
          outputSchema: { published: "boolean", url: "string?", platform: "string" },
        },
        {
          name: "list-platforms",
          description: "List available publishing platforms",
          inputSchema: {},
          outputSchema: { platforms: "string[]" },
        },
      ],
    });
    this.executor = executor;
    this.integrationsDir = integrationsDir;
  }

  async init() {
    await this.loadIntegrations();
  }

  private async loadIntegrations() {
    try {
      const files = await readdir(this.integrationsDir);
      for (const file of files) {
        if (file.endsWith(".json")) {
          const content = await readFile(join(this.integrationsDir, file), "utf-8");
          const integration: Integration = JSON.parse(content);
          this.integrations.set(integration.name, integration);
        }
      }
      if (this.integrations.size > 0) {
        console.log(`📤 Publisher loaded ${this.integrations.size} integrations: ${Array.from(this.integrations.keys()).join(", ")}`);
      }
    } catch {}
  }

  async handle(message: Message): Promise<Message> {
    const task = message.payload as TaskPayload;

    if (task.action === "list-platforms") {
      return createMessage(
        this.name,
        message.from,
        "result",
        {
          success: true,
          output: { platforms: Array.from(this.integrations.keys()) },
        } satisfies ResultPayload,
        message.id
      );
    }

    const platform = task.input.platform?.toLowerCase();
    if (!platform) {
      return createMessage(this.name, message.from, "error", {
        code: "MISSING_PLATFORM",
        message: "Specify a platform to publish to",
        retryable: false,
      }, message.id);
    }

    const integration = this.integrations.get(platform);
    if (!integration) {
      // Tell orchestrator we need this integration built
      return createMessage(this.name, message.from, "error", {
        code: "INTEGRATION_NOT_FOUND",
        message: `No integration for "${platform}". Available: ${Array.from(this.integrations.keys()).join(", ") || "none"}. Need to build it first.`,
        retryable: false,
        needsBuild: platform,
      }, message.id);
    }

    // Execute the integration
    const result = await this.executor.run(integration.code, {
      action: "publish",
      title: task.input.title,
      content: task.input.content,
      ...task.input,
    });

    return createMessage(
      this.name,
      message.from,
      result.success ? "result" : "error",
      result.success
        ? { success: true, output: { published: true, platform, result: result.output } }
        : { code: "PUBLISH_FAILED", message: result.error, retryable: true },
      message.id
    );
  }

  // Reload integrations (after a new one is built)
  async reload() {
    this.integrations.clear();
    await this.loadIntegrations();
  }
}
