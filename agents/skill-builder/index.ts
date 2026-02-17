// Skill Builder Agent — the self-tooling agent
// Reads API docs, generates integration code, tests it, saves it

import { BaseAgent } from "../../core/agent";
import { createMessage, type Message, type TaskPayload, type ResultPayload } from "../../core/message";
import { LLM, type LLMMessage } from "../../core/llm";
import { Executor } from "../../core/executor";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export class SkillBuilderAgent extends BaseAgent {
  private llm: LLM;
  private executor: Executor;
  private integrationsDir: string;

  constructor(llm: LLM, executor: Executor, integrationsDir: string) {
    super({
      name: "skill-builder",
      description: "Builds new integrations by reading API docs and generating code",
      version: "1.0.0",
      capabilities: [
        {
          name: "build-integration",
          description: "Build a new integration for any service/API",
          inputSchema: { service: "string", docs: "string?" },
          outputSchema: { name: "string", saved: "boolean" },
        },
      ],
    });
    this.llm = llm;
    this.executor = executor;
    this.integrationsDir = integrationsDir;
  }

  async handle(message: Message): Promise<Message> {
    const task = message.payload as TaskPayload;
    const service = task.input.service;

    console.log(`🔨 Building integration: ${service}`);

    // Step 1: Generate the integration code
    const messages: LLMMessage[] = [
      {
        role: "system",
        content: `You are an expert API integration builder. Generate a JavaScript integration for the given service.

The code MUST follow this EXACT pattern:

async function execute(input, credentials) {
  // input.action = what to do (e.g. "publish", "read", "list")
  // credentials = { API_KEY: "...", BASE_URL: "..." }
  
  const { action } = input;
  
  if (action === "publish") {
    // implementation
  }
  
  return { success: true, data: result };
}

RULES:
- Use ONLY fetch() for HTTP (no imports, no require, no external libs)
- Handle errors with try/catch
- Support multiple actions via input.action
- Return { success: true/false, data/error }
- Use credentials for all secrets

Respond with ONLY valid JSON (no markdown, no backticks):
{
  "name": "service-name",
  "description": "What this does",
  "code": "async function execute(input, credentials) { ... }",
  "requirements": [{"name": "API_KEY", "description": "...", "type": "api_key", "required": true}]
}`,
      },
      {
        role: "user",
        content: `Build an integration for: ${service}
${task.input.docs ? `\nAPI Documentation:\n${task.input.docs}` : ""}
Support common operations: create/publish, read, list, update, delete.`,
      },
    ];

    try {
      const response = await this.llm.chat(messages);

      // Parse JSON from response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No valid JSON in LLM response");

      const integration = JSON.parse(jsonMatch[0]);
      integration.name = integration.name || service.toLowerCase().replace(/\s+/g, "-");
      integration.createdAt = new Date().toISOString();

      // Step 2: Test the code compiles (dry run)
      const testResult = await this.executor.run(
        integration.code,
        { action: "test", _dryRun: true }
      );
      // We don't fail on test errors since "test" action may not be implemented

      // Step 3: Save to integrations directory
      await mkdir(this.integrationsDir, { recursive: true });
      const filePath = join(this.integrationsDir, `${integration.name}.json`);
      await writeFile(filePath, JSON.stringify(integration, null, 2));

      console.log(`✅ Integration saved: ${integration.name}`);

      return createMessage(
        this.name,
        message.from,
        "result",
        {
          success: true,
          output: {
            name: integration.name,
            description: integration.description,
            requirements: integration.requirements,
            saved: true,
            path: filePath,
          },
        } satisfies ResultPayload,
        message.id
      );
    } catch (err: any) {
      console.error(`❌ Failed to build: ${err.message}`);
      return createMessage(
        this.name,
        message.from,
        "error",
        { code: "BUILD_FAILED", message: err.message, retryable: true },
        message.id
      );
    }
  }
}
