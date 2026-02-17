// Auth — simple API key + session auth for the dashboard
// Production: replace with proper JWT/OAuth

import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";

export interface User {
  id: string;
  email: string;
  name: string;
  apiKey: string;
  role: "admin" | "user";
  tenantIds: string[];     // which tenants this user can access
  createdAt: string;
}

export class Auth {
  private users: Map<string, User> = new Map();
  private apiKeys: Map<string, User> = new Map();   // apiKey → User
  private sessions: Map<string, User> = new Map();   // sessionToken → User
  private dataDir: string;
  private enabled: boolean;

  constructor(dataDir: string, enabled: boolean = true) {
    this.dataDir = dataDir;
    this.enabled = enabled;
  }

  async init() {
    await mkdir(this.dataDir, { recursive: true });
    await this.loadUsers();

    // Create default admin if no users exist
    if (this.users.size === 0) {
      const adminKey = `arise_${this.randomKey()}`;
      await this.createUser({
        email: "admin@arise.local",
        name: "Admin",
        role: "admin",
        apiKey: adminKey,
        tenantIds: ["*"],
      });
      console.log(`🔒 Auth: default admin created. API Key: ${adminKey}`);
    } else {
      console.log(`🔒 Auth: ${this.users.size} users`);
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  // Authenticate by API key (for API calls)
  authenticateApiKey(key: string): User | null {
    if (!this.enabled) return { id: "anon", email: "", name: "Anonymous", apiKey: "", role: "admin", tenantIds: ["*"], createdAt: "" };
    return this.apiKeys.get(key) || null;
  }

  // Authenticate by session token (for dashboard)
  authenticateSession(token: string): User | null {
    if (!this.enabled) return { id: "anon", email: "", name: "Anonymous", apiKey: "", role: "admin", tenantIds: ["*"], createdAt: "" };
    return this.sessions.get(token) || null;
  }

  // Login with API key, returns session token
  login(apiKey: string): { token: string; user: User } | null {
    const user = this.apiKeys.get(apiKey);
    if (!user) return null;
    const token = `sess_${this.randomKey()}`;
    this.sessions.set(token, user);
    return { token, user };
  }

  logout(token: string) {
    this.sessions.delete(token);
  }

  // Check if user can access a tenant
  canAccessTenant(user: User, tenantId: string): boolean {
    if (user.role === "admin") return true;
    return user.tenantIds.includes("*") || user.tenantIds.includes(tenantId);
  }

  // Create user
  async createUser(data: { email: string; name: string; role?: string; apiKey?: string; tenantIds?: string[] }): Promise<User> {
    const id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const user: User = {
      id,
      email: data.email,
      name: data.name,
      apiKey: data.apiKey || `arise_${this.randomKey()}`,
      role: (data.role as "admin" | "user") || "user",
      tenantIds: data.tenantIds || [],
      createdAt: new Date().toISOString(),
    };

    this.users.set(id, user);
    this.apiKeys.set(user.apiKey, user);
    await this.saveUsers();
    return user;
  }

  // List users (admin only)
  listUsers(): User[] {
    return Array.from(this.users.values()).map((u) => ({
      ...u,
      apiKey: u.apiKey.slice(0, 10) + "...",  // mask API keys
    }));
  }

  // Delete user
  async deleteUser(id: string): Promise<boolean> {
    const user = this.users.get(id);
    if (!user) return false;
    this.users.delete(id);
    this.apiKeys.delete(user.apiKey);
    await this.saveUsers();
    return true;
  }

  private async loadUsers() {
    try {
      const data = await readFile(join(this.dataDir, "users.json"), "utf-8");
      const users: User[] = JSON.parse(data);
      for (const u of users) {
        this.users.set(u.id, u);
        this.apiKeys.set(u.apiKey, u);
      }
    } catch {}
  }

  private async saveUsers() {
    await writeFile(join(this.dataDir, "users.json"), JSON.stringify(Array.from(this.users.values()), null, 2));
  }

  private randomKey(): string {
    return Array.from({ length: 32 }, () => Math.random().toString(36)[2]).join("");
  }
}
