// Response Cache — cache identical requests to avoid redundant LLM calls
// ZERO quality loss — same exact output, just instant + free on repeat

import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { createHash } from "crypto";

interface CacheEntry {
  key: string;
  tenantId: string;
  agent: string;
  action: string;
  inputHash: string;
  output: any;
  createdAt: number;
  expiresAt: number;
  hits: number;
}

export class ResponseCache {
  private cache: Map<string, CacheEntry> = new Map();
  private dataDir: string;
  private defaultTTL: number; // ms
  private maxEntries: number;
  private stats = { hits: 0, misses: 0, saves: 0 };

  constructor(dataDir: string, options?: { ttlMs?: number; maxEntries?: number }) {
    this.dataDir = join(dataDir, "cache");
    this.defaultTTL = options?.ttlMs || 60 * 60 * 1000; // 1 hour default
    this.maxEntries = options?.maxEntries || 10000;
  }

  async init() {
    await mkdir(this.dataDir, { recursive: true });
    await this.load();
    // Clean expired on startup
    this.cleanup();
    console.log(`💾 Cache: ${this.cache.size} entries loaded`);
  }

  // Generate cache key from request
  private makeKey(tenantId: string, agent: string, action: string, input: any): string {
    // Tenant-scoped: same request from different tenants = different cache entries
    const raw = JSON.stringify({ tenantId, agent, action, input });
    return createHash("sha256").update(raw).digest("hex");
  }

  // Try to get cached response
  get(tenantId: string, agent: string, action: string, input: any): any | null {
    const key = this.makeKey(tenantId, agent, action, input);
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check expiry
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Cache hit!
    entry.hits++;
    this.stats.hits++;
    return entry.output;
  }

  // Store response in cache
  async set(tenantId: string, agent: string, action: string, input: any, output: any, ttlMs?: number): Promise<void> {
    const key = this.makeKey(tenantId, agent, action, input);
    const now = Date.now();

    const entry: CacheEntry = {
      key,
      tenantId,
      agent,
      action,
      inputHash: createHash("sha256").update(JSON.stringify(input)).digest("hex").slice(0, 16),
      output,
      createdAt: now,
      expiresAt: now + (ttlMs || this.defaultTTL),
      hits: 0,
    };

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxEntries) {
      this.evictOldest();
    }

    this.cache.set(key, entry);
    this.stats.saves++;
    await this.save();
  }

  // Invalidate cache for a tenant (e.g., when they update brand info)
  invalidateTenant(tenantId: string): number {
    let count = 0;
    for (const [key, entry] of this.cache) {
      if (entry.tenantId === tenantId) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  // Invalidate specific agent cache for a tenant
  invalidateAgent(tenantId: string, agent: string): number {
    let count = 0;
    for (const [key, entry] of this.cache) {
      if (entry.tenantId === tenantId && entry.agent === agent) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  // Get cache stats
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? ((this.stats.hits / (this.stats.hits + this.stats.misses)) * 100).toFixed(1)
      : "0";
    return {
      entries: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      saves: this.stats.saves,
      hitRate: `${hitRate}%`,
      estimatedSavings: `${this.stats.hits} LLM calls avoided`,
    };
  }

  // TTL configs per action type (some things should cache longer)
  static getTTL(action: string): number {
    const ttls: Record<string, number> = {
      // Long cache — these don't change often
      "brand-guidelines": 24 * 60 * 60 * 1000, // 24h
      "voice-design": 24 * 60 * 60 * 1000,
      "positioning": 24 * 60 * 60 * 1000,

      // Medium cache — somewhat stable
      "keyword-research": 6 * 60 * 60 * 1000, // 6h
      "hashtag-research": 6 * 60 * 60 * 1000,
      "site-audit": 6 * 60 * 60 * 1000,
      "pricing-analysis": 6 * 60 * 60 * 1000,

      // Short cache — creative content (different each time unless identical input)
      "write-blog": 60 * 60 * 1000, // 1h
      "write-social": 30 * 60 * 1000, // 30min
      "ab-subject-lines": 30 * 60 * 1000,

      // No cache — should always be fresh
      "find-trends": 0,
      "daily-posts": 0,
      "find-leads": 0,
      "research": 15 * 60 * 1000, // 15min (web results change)
    };
    return ttls[action] ?? 60 * 60 * 1000; // default 1h
  }

  // --- Internal ---

  private cleanup() {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    if (cleaned > 0) console.log(`💾 Cache: cleaned ${cleaned} expired entries`);
  }

  private evictOldest() {
    let oldest: string | null = null;
    let oldestTime = Infinity;
    for (const [key, entry] of this.cache) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldest = key;
      }
    }
    if (oldest) this.cache.delete(oldest);
  }

  private async save() {
    const entries = Array.from(this.cache.values());
    await writeFile(join(this.dataDir, "responses.json"), JSON.stringify(entries, null, 2));
  }

  private async load() {
    try {
      const data = await readFile(join(this.dataDir, "responses.json"), "utf-8");
      const entries: CacheEntry[] = JSON.parse(data);
      for (const entry of entries) {
        this.cache.set(entry.key, entry);
      }
    } catch { /* no cache yet */ }
  }
}
