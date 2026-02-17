// Content Repurposer Agent — one content → many formats

import { BaseAgent } from "../../core/agent";
import { createMessage, type Message, type TaskPayload, type ResultPayload } from "../../core/message";
import { LLM, type LLMMessage } from "../../core/llm";

export class ContentRepurposerAgent extends BaseAgent {
  private llm: LLM;

  constructor(llm: LLM) {
    super({
      name: "content-repurposer",
      description: "Transforms one piece of content into multiple formats — blog to thread, podcast to article, video to posts",
      version: "1.0.0",
      capabilities: [
        { name: "repurpose-all", description: "Convert content into all available formats", inputSchema: { content: "string", sourceType: "string?", title: "string?" }, outputSchema: { formats: "object" } },
        { name: "blog-to-thread", description: "Convert blog post to Twitter/X thread", inputSchema: { content: "string" }, outputSchema: { thread: "string[]" } },
        { name: "blog-to-linkedin", description: "Convert blog to LinkedIn article/post", inputSchema: { content: "string" }, outputSchema: { post: "string" } },
        { name: "blog-to-youtube-script", description: "Convert blog to YouTube video script", inputSchema: { content: "string" }, outputSchema: { script: "object" } },
        { name: "blog-to-email", description: "Convert blog to newsletter email", inputSchema: { content: "string" }, outputSchema: { email: "object" } },
        { name: "blog-to-carousel", description: "Convert blog to Instagram/LinkedIn carousel slides", inputSchema: { content: "string" }, outputSchema: { slides: "object[]" } },
        { name: "transcript-to-blog", description: "Convert podcast/video transcript to blog article", inputSchema: { transcript: "string" }, outputSchema: { blog: "object" } },
        { name: "content-to-ebook-chapter", description: "Convert multiple blogs into an eBook chapter", inputSchema: { contents: "string[]", topic: "string" }, outputSchema: { chapter: "object" } },
      ],
    });
    this.llm = llm;
  }

  async handle(message: Message): Promise<Message> {
    const task = message.payload as TaskPayload;
    try {
      let output: any;
      switch (task.action) {
        case "repurpose-all": output = await this.repurposeAll(task.input); break;
        case "blog-to-thread": output = await this.toThread(task.input.content); break;
        case "blog-to-linkedin": output = await this.toLinkedIn(task.input.content); break;
        case "blog-to-youtube-script": output = await this.toYouTubeScript(task.input.content); break;
        case "blog-to-email": output = await this.toEmail(task.input.content); break;
        case "blog-to-carousel": output = await this.toCarousel(task.input.content); break;
        case "transcript-to-blog": output = await this.transcriptToBlog(task.input.transcript); break;
        case "content-to-ebook-chapter": output = await this.toEbookChapter(task.input); break;
        default: output = await this.repurposeAll(task.input);
      }
      return createMessage(this.name, message.from, "result", { success: true, output } satisfies ResultPayload, message.id);
    } catch (err: any) {
      return createMessage(this.name, message.from, "error", { code: "REPURPOSE_ERROR", message: err.message, retryable: true }, message.id);
    }
  }

  private async repurposeAll(input: any): Promise<any> {
    const content = input.content;
    const title = input.title || "";
    const [thread, linkedin, script, email, carousel] = await Promise.all([
      this.toThread(content),
      this.toLinkedIn(content),
      this.toYouTubeScript(content),
      this.toEmail(content),
      this.toCarousel(content),
    ]);
    return { sourceTitle: title, formats: { twitterThread: thread, linkedinPost: linkedin, youtubeScript: script, newsletter: email, carousel } };
  }

  private async toThread(content: string): Promise<any> {
    const messages: LLMMessage[] = [
      { role: "system", content: `Convert blog content into a viral Twitter/X thread. Rules: max 280 chars per tweet, 5-10 tweets, hook in first tweet, end with CTA. Output valid JSON.` },
      { role: "user", content: `Convert to thread:\n\n${content.slice(0, 4000)}\n\nReturn JSON:\n{ "tweets": ["tweet1", "tweet2", ...], "hashtags": [] }` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { tweets: [response.content.slice(0, 280)] }; }
  }

  private async toLinkedIn(content: string): Promise<any> {
    const messages: LLMMessage[] = [
      { role: "system", content: `Convert blog to a LinkedIn post. Hook in first line, use line breaks, professional tone, 1300 chars max, 3-5 hashtags. Output valid JSON.` },
      { role: "user", content: `Convert:\n\n${content.slice(0, 4000)}\n\nReturn JSON:\n{ "post": "", "hashtags": [] }` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { post: response.content.slice(0, 1300) }; }
  }

  private async toYouTubeScript(content: string): Promise<any> {
    const messages: LLMMessage[] = [
      { role: "system", content: `Convert blog to a YouTube video script with hook, sections, and CTA. Output valid JSON.` },
      { role: "user", content: `Convert:\n\n${content.slice(0, 5000)}\n\nReturn JSON:\n{ "title": "", "description": "", "hook": "first 30 seconds", "sections": [{ "timestamp": "", "heading": "", "script": "", "bRoll": "" }], "cta": "", "estimatedLength": "" }` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { script: response.content }; }
  }

  private async toEmail(content: string): Promise<any> {
    const messages: LLMMessage[] = [
      { role: "system", content: `Convert blog to a newsletter email. Engaging subject, concise body, clear CTA. Output valid JSON.` },
      { role: "user", content: `Convert:\n\n${content.slice(0, 4000)}\n\nReturn JSON:\n{ "subject": "", "preheader": "", "body": "", "cta": { "text": "", "url": "{{URL}}" } }` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { body: response.content }; }
  }

  private async toCarousel(content: string): Promise<any> {
    const messages: LLMMessage[] = [
      { role: "system", content: `Convert blog to Instagram/LinkedIn carousel slides. 8-12 slides, one key point per slide, visual-friendly text. Output valid JSON.` },
      { role: "user", content: `Convert:\n\n${content.slice(0, 4000)}\n\nReturn JSON:\n{ "slides": [{ "number": 1, "heading": "", "body": "", "visualNote": "what image/graphic to use" }], "caption": "", "hashtags": [] }` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { slides: [{ body: response.content }] }; }
  }

  private async transcriptToBlog(transcript: string): Promise<any> {
    const messages: LLMMessage[] = [
      { role: "system", content: `Convert a podcast/video transcript into a well-structured blog post. Clean up filler words, add headings, make it scannable. Output valid JSON.` },
      { role: "user", content: `Convert transcript to blog:\n\n${transcript.slice(0, 8000)}\n\nReturn JSON:\n{ "title": "", "content": "full markdown blog", "summary": "", "keyTakeaways": [] }` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { content: response.content }; }
  }

  private async toEbookChapter(input: any): Promise<any> {
    const contents = input.contents || [input.content];
    const combined = contents.map((c: string, i: number) => `--- Article ${i + 1} ---\n${c}`).join("\n\n");
    const messages: LLMMessage[] = [
      { role: "system", content: `Combine multiple articles into a cohesive eBook chapter. Unify voice, remove redundancy, add transitions. Output valid JSON.` },
      { role: "user", content: `Topic: ${input.topic}\n\n${combined.slice(0, 10000)}\n\nReturn JSON:\n{ "chapterTitle": "", "content": "full chapter in markdown", "wordCount": 0, "sections": [] }` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { content: response.content }; }
  }
}
