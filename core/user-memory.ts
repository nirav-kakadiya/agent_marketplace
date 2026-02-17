// User Memory — persists user preferences, brand info, and past interactions
// So agents remember context across sessions

import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";

export interface UserPreferences {
  // Brand info (learned from user)
  brand?: {
    name?: string;
    voice?: string;
    tone?: string;
    audience?: string;
    industry?: string;
    keywords?: string[];
    avoidWords?: string[];
    url?: string;
  };

  // Content preferences
  content?: {
    defaultTone?: string;
    defaultWordCount?: number;
    defaultPlatforms?: string[];
    preferredFormat?: string;
  };

  // Platform credentials status (not the actual keys, just what's configured)
  platforms?: string[];

  // Past topics (for context and avoiding repetition)
  pastTopics?: string[];

  // Custom instructions
  customInstructions?: string;

  // Last interaction
  lastSeen?: string;
  totalInteractions?: number;
}

export class UserMemory {
  private dataDir: string;
  private memories: Map<string, UserPreferences> = new Map();

  constructor(dataDir: string) {
    this.dataDir = dataDir;
  }

  async init() {
    await mkdir(this.dataDir, { recursive: true });
    await this.load();
  }

  // Get user preferences (creates default if new user)
  get(userId: string): UserPreferences {
    if (!this.memories.has(userId)) {
      this.memories.set(userId, { totalInteractions: 0 });
    }
    return this.memories.get(userId)!;
  }

  // Update user preferences (merges, doesn't replace)
  async update(userId: string, updates: Partial<UserPreferences>): Promise<void> {
    const current = this.get(userId);
    const merged: UserPreferences = {
      ...current,
      ...updates,
      brand: { ...current.brand, ...updates.brand },
      content: { ...current.content, ...updates.content },
      lastSeen: new Date().toISOString(),
      totalInteractions: (current.totalInteractions || 0) + 1,
    };

    // Track past topics (keep last 50)
    if (updates.pastTopics) {
      merged.pastTopics = [...new Set([...(current.pastTopics || []), ...updates.pastTopics])].slice(-50);
    }

    this.memories.set(userId, merged);
    await this.save();
  }

  // Learn brand info from a message (LLM extracts brand details)
  async learnFromMessage(userId: string, message: string): Promise<string[]> {
    const learned: string[] = [];
    const prefs = this.get(userId);

    // Simple pattern matching for brand info
    const urlMatch = message.match(/https?:\/\/[\w.-]+\.\w+/);
    if (urlMatch && !prefs.brand?.url) {
      await this.update(userId, { brand: { url: urlMatch[0] } });
      learned.push(`Saved your website: ${urlMatch[0]}`);
    }

    return learned;
  }

  // Get context string for LLM (so agents know about the user)
  getContext(userId: string): string {
    const prefs = this.get(userId);
    if (!prefs.brand && !prefs.content && !prefs.customInstructions) {
      return "";
    }

    let context = "## User Context (remembered from past interactions)\n\n";

    if (prefs.brand) {
      if (prefs.brand.name) context += `Brand: ${prefs.brand.name}\n`;
      if (prefs.brand.url) context += `Website: ${prefs.brand.url}\n`;
      if (prefs.brand.voice) context += `Voice: ${prefs.brand.voice}\n`;
      if (prefs.brand.tone) context += `Tone: ${prefs.brand.tone}\n`;
      if (prefs.brand.audience) context += `Audience: ${prefs.brand.audience}\n`;
      if (prefs.brand.industry) context += `Industry: ${prefs.brand.industry}\n`;
      if (prefs.brand.keywords?.length) context += `Keywords: ${prefs.brand.keywords.join(", ")}\n`;
      if (prefs.brand.avoidWords?.length) context += `Avoid: ${prefs.brand.avoidWords.join(", ")}\n`;
    }

    if (prefs.content) {
      if (prefs.content.defaultTone) context += `Preferred tone: ${prefs.content.defaultTone}\n`;
      if (prefs.content.defaultPlatforms?.length) context += `Platforms: ${prefs.content.defaultPlatforms.join(", ")}\n`;
    }

    if (prefs.customInstructions) {
      context += `\nCustom instructions: ${prefs.customInstructions}\n`;
    }

    if (prefs.pastTopics?.length) {
      context += `\nRecent topics: ${prefs.pastTopics.slice(-5).join(", ")}\n`;
    }

    return context;
  }

  // List all users
  listUsers(): string[] {
    return Array.from(this.memories.keys());
  }

  // === Persistence ===

  private async load() {
    try {
      const data = await readFile(join(this.dataDir, "user-memories.json"), "utf-8");
      const entries: [string, UserPreferences][] = JSON.parse(data);
      for (const [id, prefs] of entries) {
        this.memories.set(id, prefs);
      }
      console.log(`🧠 User Memory: ${this.memories.size} users loaded`);
    } catch {
      console.log("🧠 User Memory: starting fresh");
    }
  }

  private async save() {
    await writeFile(
      join(this.dataDir, "user-memories.json"),
      JSON.stringify(Array.from(this.memories.entries()), null, 2),
    );
  }
}
