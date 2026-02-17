// Editor Agent — reviews, improves, and optimizes content

import { BaseAgent } from "../../core/agent";
import { createMessage, type Message, type TaskPayload, type ResultPayload } from "../../core/message";
import { LLM, type LLMMessage } from "../../core/llm";

export class EditorAgent extends BaseAgent {
  private llm: LLM;

  constructor(llm: LLM) {
    super({
      name: "editor",
      description: "Reviews and improves content — grammar, SEO, readability, structure",
      version: "1.0.0",
      capabilities: [
        {
          name: "edit",
          description: "Edit and improve content for quality, grammar, and clarity",
          inputSchema: { content: "string", focus: "string?" },
          outputSchema: { editedContent: "string", changes: "string[]" },
        },
        {
          name: "seo-optimize",
          description: "Optimize content for search engines",
          inputSchema: { content: "string", keywords: "string[]?" },
          outputSchema: { optimizedContent: "string", seoScore: "number" },
        },
      ],
    });
    this.llm = llm;
  }

  async handle(message: Message): Promise<Message> {
    const task = message.payload as TaskPayload;
    const action = task.action || "edit";

    const systemPrompt = action === "seo-optimize"
      ? `You are an SEO specialist and editor. Optimize the content for search engines while keeping it readable and engaging.

Tasks:
1. Add/improve meta-relevant title and headers (H2, H3)
2. Naturally incorporate keywords
3. Improve readability (short paragraphs, bullet points)
4. Add internal linking suggestions
5. Optimize intro for featured snippets
6. Ensure proper keyword density (1-2%)

${task.input.keywords ? `Target keywords: ${task.input.keywords.join(", ")}` : "Identify and optimize for relevant keywords."}

Output the FULL improved content, then list changes made.`
      : `You are a senior editor. Improve the content for quality, clarity, and engagement.

Tasks:
1. Fix grammar and spelling
2. Improve sentence structure and flow
3. Ensure consistent tone
4. Strengthen weak sections
5. Improve transitions between sections
6. Make the intro and conclusion more compelling

Output the FULL improved content, then list key changes made.

Format:
[Full edited content]

---
## Changes Made
- [change 1]
- [change 2]`;

    const messages: LLMMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Edit this content:\n\n${task.input.content}` },
    ];

    const response = await this.llm.chat(messages);

    // Split content and changes
    const parts = response.content.split(/---\s*\n##\s*Changes Made/i);
    const editedContent = parts[0].trim();
    const changes = parts[1]
      ? parts[1].trim().split("\n").filter((l) => l.startsWith("-")).map((l) => l.slice(2))
      : ["Content improved"];

    return createMessage(
      this.name,
      message.from,
      "result",
      {
        success: true,
        output: { editedContent, changes },
      } satisfies ResultPayload,
      message.id
    );
  }
}
