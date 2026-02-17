// Memory — shared + per-agent persistent memory

import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";

export interface MemoryEntry {
  key: string;
  value: any;
  agent: string;     // which agent stored this
  tags: string[];    // for search
  timestamp: string;
}

export class Memory {
  private entries: Map<string, MemoryEntry> = new Map();
  private dir: string;
  private filePath: string;

  constructor(dir: string) {
    this.dir = dir;
    this.filePath = join(dir, "memory.json");
  }

  async init() {
    await mkdir(this.dir, { recursive: true });
    try {
      const data = await readFile(this.filePath, "utf-8");
      const entries: MemoryEntry[] = JSON.parse(data);
      for (const e of entries) this.entries.set(e.key, e);
    } catch {}
    console.log(`🧠 Memory: ${this.entries.size} entries`);
  }

  private async save() {
    await writeFile(this.filePath, JSON.stringify(Array.from(this.entries.values()), null, 2));
  }

  async set(key: string, value: any, agent: string, tags: string[] = []): Promise<void> {
    this.entries.set(key, { key, value, agent, tags, timestamp: new Date().toISOString() });
    await this.save();
  }

  get(key: string): any | undefined {
    return this.entries.get(key)?.value;
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  // Get all memories from a specific agent
  byAgent(agent: string): MemoryEntry[] {
    return Array.from(this.entries.values()).filter((e) => e.agent === agent);
  }

  // Search by tags or content
  search(query: string): MemoryEntry[] {
    const q = query.toLowerCase();
    return Array.from(this.entries.values()).filter(
      (e) =>
        e.key.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q)) ||
        JSON.stringify(e.value).toLowerCase().includes(q)
    );
  }

  // Summary for LLM context
  summary(agent?: string): string {
    const entries = agent ? this.byAgent(agent) : Array.from(this.entries.values());
    if (entries.length === 0) return "No memories yet.";
    return entries.map((e) => `[${e.agent}] ${e.key}: ${JSON.stringify(e.value)}`).join("\n");
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
    await this.save();
  }
}
