// Publisher Agent — publishes content to platforms using integration configs

import { BaseAgent } from "../../core/agent";
import { createMessage, type Message, type TaskPayload, type ResultPayload } from "../../core/message";
import { readdir, readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";

interface Integration {
  name: string;
  description: string;
  code: string;
  requirements: { name: string; description: string; type: string; required: boolean }[];
}

export class PublisherAgent extends BaseAgent {
  private integrationsDir: string;
  private outputDir: string;
  private integrations: Map<string, Integration> = new Map();
  private credentials: Map<string, string> = new Map();

  constructor(integrationsDir: string, outputDir: string) {
    super({
      name: "publisher",
      description: "Publishes content to platforms — WordPress, Twitter, LinkedIn, Medium, Dev.to, local files",
      version: "2.0.0",
      capabilities: [
        {
          name: "publish",
          description: "Publish content to one or more platforms",
          inputSchema: { content: "string", title: "string?", platforms: "string[]?", draft: "boolean?" },
          outputSchema: { results: "object[]" },
        },
        {
          name: "list-integrations",
          description: "List available publishing integrations",
          inputSchema: {},
          outputSchema: { integrations: "string[]" },
        },
      ],
    });
    this.integrationsDir = integrationsDir;
    this.outputDir = outputDir;
  }

  setCredential(key: string, value: string) {
    this.credentials.set(key, value);
  }

  async init() {
    await mkdir(this.outputDir, { recursive: true });
    await this.loadIntegrations();
  }

  private async loadIntegrations() {
    try {
      const files = await readdir(this.integrationsDir);
      for (const f of files) {
        if (!f.endsWith(".json")) continue;
        try {
          const data = JSON.parse(await readFile(join(this.integrationsDir, f), "utf-8"));
          this.integrations.set(data.name, data);
        } catch {}
      }
      console.log(`📤 Publisher: ${this.integrations.size} integrations loaded`);
    } catch {
      console.log("📤 Publisher: no integrations found");
    }
  }

  async handle(message: Message): Promise<Message> {
    const task = message.payload as TaskPayload;

    try {
      let output: any;

      switch (task.action) {
        case "list-integrations":
          output = { integrations: Array.from(this.integrations.keys()) };
          break;
        case "publish":
        default:
          output = await this.publish(task.input);
      }

      return createMessage(this.name, message.from, "result", {
        success: true,
        output,
      } satisfies ResultPayload, message.id);
    } catch (err: any) {
      return createMessage(this.name, message.from, "error", {
        code: "PUBLISHER_ERROR",
        message: err.message,
        retryable: true,
      }, message.id);
    }
  }

  private async publish(input: any): Promise<any> {
    const platforms = input.platforms || ["local-file"];
    const results: any[] = [];

    for (const platform of platforms) {
      try {
        if (platform === "local-file") {
          const result = await this.saveLocally(input);
          results.push({ platform, ...result });
        } else {
          const integration = this.integrations.get(platform);
          if (!integration) {
            results.push({ platform, success: false, error: `No integration for: ${platform}` });
            continue;
          }
          const result = await this.executeIntegration(integration, input);
          results.push({ platform, ...result });
        }
      } catch (err: any) {
        results.push({ platform, success: false, error: err.message });
      }
    }

    return { results, publishedAt: new Date().toISOString() };
  }

  private async saveLocally(input: any): Promise<any> {
    const slug = (input.slug || input.title || `post-${Date.now()}`)
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50);
    const filename = `${slug}.md`;
    const filepath = join(this.outputDir, filename);

    let content = "";
    if (input.title) content += `# ${input.title}\n\n`;
    if (input.metaDescription) content += `> ${input.metaDescription}\n\n`;
    content += input.content || "";

    await writeFile(filepath, content);
    return { success: true, path: filepath, filename };
  }

  private async executeIntegration(integration: Integration, input: any): Promise<any> {
    // Build credentials object from stored credentials
    const creds: Record<string, string> = {};
    for (const req of integration.requirements) {
      const val = this.credentials.get(req.name);
      if (val) creds[req.name] = val;
      else if (req.required) {
        return { success: false, error: `Missing credential: ${req.name}` };
      }
    }

    // Execute the integration code
    try {
      const fn = new Function("input", "credentials", `return (async () => { ${integration.code} \n return await execute(input, credentials); })()`);
      return await fn({ ...input, action: input.action || "publish" }, creds);
    } catch (err: any) {
      return { success: false, error: `Integration error: ${err.message}` };
    }
  }
}
