// Researcher Agent — searches the web and gathers information

import { BaseAgent } from "../../core/agent";
import { createMessage, type Message, type TaskPayload, type ResultPayload } from "../../core/message";
import { LLM, type LLMMessage } from "../../core/llm";

export class ResearcherAgent extends BaseAgent {
  private llm: LLM;

  constructor(llm: LLM) {
    super({
      name: "researcher",
      description: "Researches topics by searching the web and analyzing information",
      version: "1.0.0",
      capabilities: [
        {
          name: "research",
          description: "Research a topic and provide structured findings",
          inputSchema: { topic: "string", depth: "string (quick|deep)" },
          outputSchema: { findings: "string", sources: "string[]" },
        },
        {
          name: "fact-check",
          description: "Verify claims and find supporting evidence",
          inputSchema: { claim: "string" },
          outputSchema: { verified: "boolean", evidence: "string" },
        },
      ],
    });
    this.llm = llm;
  }

  async handle(message: Message): Promise<Message> {
    const task = message.payload as TaskPayload;

    const messages: LLMMessage[] = [
      {
        role: "system",
        content: `You are a research specialist. Your job is to research topics thoroughly and provide structured, factual findings.

For each research task:
1. Identify key aspects of the topic
2. Provide current, accurate information
3. Include specific data points, statistics, and trends
4. Note any controversies or differing viewpoints
5. Structure your findings clearly

Output format:
## Key Findings
[structured findings]

## Key Statistics
[relevant numbers/data]

## Trends
[current trends]

## Sources/References
[where this info comes from]`,
      },
      {
        role: "user",
        content: `Research this topic: ${task.input.topic || JSON.stringify(task.input)}
${task.input.depth === "deep" ? "Go deep — provide extensive detail." : "Quick overview — key points only."}`,
      },
    ];

    const response = await this.llm.chat(messages);

    return createMessage(
      this.name,
      message.from,
      "result",
      {
        success: true,
        output: {
          findings: response.content,
          topic: task.input.topic,
        },
      } satisfies ResultPayload,
      message.id
    );
  }
}
