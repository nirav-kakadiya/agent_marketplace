// Scheduler Agent — manages recurring content pipelines and content calendar
// "Publish a blog about AI every Monday at 9am"

import { BaseAgent } from "../../core/agent";
import { createMessage, type Message, type TaskPayload, type ResultPayload } from "../../core/message";
import type { Memory } from "../../core/memory";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";

export interface ScheduledJob {
  id: string;
  name: string;
  request: string;           // what to generate
  type: string;              // "blog+social" | "blog" | "social"
  schedule: {
    frequency: "once" | "daily" | "weekly" | "biweekly" | "monthly";
    dayOfWeek?: number;      // 0=Sunday, 1=Monday, etc.
    dayOfMonth?: number;     // 1-31
    hour: number;            // 0-23 UTC
    minute: number;          // 0-59
  };
  platforms?: string[];       // publish targets
  enabled: boolean;
  lastRun?: string;
  nextRun: string;
  runCount: number;
  createdAt: string;
}

export class SchedulerAgent extends BaseAgent {
  private memory: Memory;
  private jobs: Map<string, ScheduledJob> = new Map();
  private dataDir: string;
  private filePath: string;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(memory: Memory, dataDir: string) {
    super({
      name: "scheduler",
      description: "Manages recurring content generation schedules and content calendar",
      version: "1.0.0",
      capabilities: [
        {
          name: "create-schedule",
          description: "Create a recurring content generation schedule",
          inputSchema: {
            name: "string",
            request: "string",
            type: "string?",
            frequency: "once|daily|weekly|biweekly|monthly",
            dayOfWeek: "number?",
            dayOfMonth: "number?",
            hour: "number",
            minute: "number?",
            platforms: "string[]?",
          },
          outputSchema: { job: "ScheduledJob" },
        },
        {
          name: "list-schedules",
          description: "List all scheduled content jobs",
          inputSchema: {},
          outputSchema: { jobs: "ScheduledJob[]" },
        },
        {
          name: "update-schedule",
          description: "Update an existing schedule",
          inputSchema: { id: "string", updates: "Partial<ScheduledJob>" },
          outputSchema: { job: "ScheduledJob" },
        },
        {
          name: "delete-schedule",
          description: "Delete a scheduled job",
          inputSchema: { id: "string" },
          outputSchema: { deleted: "boolean" },
        },
        {
          name: "get-calendar",
          description: "Get upcoming content calendar (next N days)",
          inputSchema: { days: "number?" },
          outputSchema: { calendar: "object[]" },
        },
        {
          name: "check-due",
          description: "Check for jobs that are due to run now",
          inputSchema: {},
          outputSchema: { dueJobs: "ScheduledJob[]" },
        },
      ],
    });
    this.memory = memory;
    this.dataDir = dataDir;
    this.filePath = join(dataDir, "schedules.json");
  }

  async init() {
    await mkdir(this.dataDir, { recursive: true });
    await this.loadJobs();
    console.log(`⏰ Scheduler: ${this.jobs.size} scheduled jobs`);
  }

  private async loadJobs() {
    try {
      const data = await readFile(this.filePath, "utf-8");
      const jobs: ScheduledJob[] = JSON.parse(data);
      for (const job of jobs) this.jobs.set(job.id, job);
    } catch {}
  }

  private async saveJobs() {
    await writeFile(this.filePath, JSON.stringify(Array.from(this.jobs.values()), null, 2));
  }

  // Start the scheduler tick (check every minute for due jobs)
  startTicker(onJobDue: (job: ScheduledJob) => Promise<void>) {
    if (this.timer) return;
    this.timer = setInterval(async () => {
      const dueJobs = this.getDueJobs();
      for (const job of dueJobs) {
        console.log(`⏰ Job due: ${job.name} (${job.id})`);
        try {
          await onJobDue(job);
          job.lastRun = new Date().toISOString();
          job.runCount++;
          job.nextRun = this.calculateNextRun(job.schedule);

          // Disable one-time jobs after running
          if (job.schedule.frequency === "once") {
            job.enabled = false;
          }

          await this.saveJobs();
        } catch (err: any) {
          console.error(`❌ Scheduler error for ${job.name}: ${err.message}`);
        }
      }
    }, 60_000); // Check every minute
    console.log("⏰ Scheduler ticker started (checking every 60s)");
  }

  stopTicker() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async handle(message: Message): Promise<Message> {
    const task = message.payload as TaskPayload;
    const action = task.action;

    if (action === "create-schedule") return this.createSchedule(message, task);
    if (action === "list-schedules") return this.listSchedules(message);
    if (action === "update-schedule") return this.updateSchedule(message, task);
    if (action === "delete-schedule") return this.deleteSchedule(message, task);
    if (action === "get-calendar") return this.getCalendar(message, task);
    if (action === "check-due") return this.checkDue(message);

    return createMessage(this.name, message.from, "error", {
      code: "UNKNOWN_ACTION",
      message: `Unknown action: ${action}`,
      retryable: false,
    }, message.id);
  }

  private async createSchedule(message: Message, task: TaskPayload): Promise<Message> {
    const input = task.input;
    const id = `sched_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const schedule = {
      frequency: input.frequency || "weekly",
      dayOfWeek: input.dayOfWeek,
      dayOfMonth: input.dayOfMonth,
      hour: input.hour ?? 9,
      minute: input.minute ?? 0,
    };

    const job: ScheduledJob = {
      id,
      name: input.name || `Content: ${input.request?.substring(0, 50)}`,
      request: input.request,
      type: input.type || "blog+social",
      schedule,
      platforms: input.platforms || [],
      enabled: true,
      nextRun: this.calculateNextRun(schedule),
      runCount: 0,
      createdAt: new Date().toISOString(),
    };

    this.jobs.set(id, job);
    await this.saveJobs();

    console.log(`⏰ Schedule created: ${job.name} (${schedule.frequency} at ${schedule.hour}:${String(schedule.minute).padStart(2, "0")} UTC)`);

    return createMessage(
      this.name,
      message.from,
      "result",
      { success: true, output: { job } } satisfies ResultPayload,
      message.id
    );
  }

  private async listSchedules(message: Message): Promise<Message> {
    const jobs = Array.from(this.jobs.values());
    return createMessage(
      this.name,
      message.from,
      "result",
      { success: true, output: { jobs } } satisfies ResultPayload,
      message.id
    );
  }

  private async updateSchedule(message: Message, task: TaskPayload): Promise<Message> {
    const job = this.jobs.get(task.input.id);
    if (!job) {
      return createMessage(this.name, message.from, "error", {
        code: "NOT_FOUND",
        message: `Schedule ${task.input.id} not found`,
        retryable: false,
      }, message.id);
    }

    const updates = task.input.updates || task.input;
    if (updates.name) job.name = updates.name;
    if (updates.request) job.request = updates.request;
    if (updates.type) job.type = updates.type;
    if (updates.enabled !== undefined) job.enabled = updates.enabled;
    if (updates.platforms) job.platforms = updates.platforms;
    if (updates.schedule) {
      job.schedule = { ...job.schedule, ...updates.schedule };
      job.nextRun = this.calculateNextRun(job.schedule);
    }

    await this.saveJobs();

    return createMessage(
      this.name,
      message.from,
      "result",
      { success: true, output: { job } } satisfies ResultPayload,
      message.id
    );
  }

  private async deleteSchedule(message: Message, task: TaskPayload): Promise<Message> {
    const deleted = this.jobs.delete(task.input.id);
    if (deleted) await this.saveJobs();

    return createMessage(
      this.name,
      message.from,
      "result",
      { success: true, output: { deleted } } satisfies ResultPayload,
      message.id
    );
  }

  private async getCalendar(message: Message, task: TaskPayload): Promise<Message> {
    const days = task.input.days || 14;
    const now = new Date();
    const end = new Date(now.getTime() + days * 86400000);

    const calendar: any[] = [];

    for (const job of this.jobs.values()) {
      if (!job.enabled) continue;

      let nextRun = new Date(job.nextRun);
      while (nextRun <= end) {
        calendar.push({
          date: nextRun.toISOString(),
          jobId: job.id,
          name: job.name,
          request: job.request,
          type: job.type,
        });

        if (job.schedule.frequency === "once") break;

        // Calculate next occurrence after this one
        nextRun = new Date(nextRun.getTime() + this.getIntervalMs(job.schedule.frequency));
      }
    }

    calendar.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return createMessage(
      this.name,
      message.from,
      "result",
      { success: true, output: { calendar, days } } satisfies ResultPayload,
      message.id
    );
  }

  private async checkDue(message: Message): Promise<Message> {
    const dueJobs = this.getDueJobs();
    return createMessage(
      this.name,
      message.from,
      "result",
      { success: true, output: { dueJobs } } satisfies ResultPayload,
      message.id
    );
  }

  // Get jobs that are due to run
  getDueJobs(): ScheduledJob[] {
    const now = new Date();
    return Array.from(this.jobs.values()).filter((job) => {
      if (!job.enabled) return false;
      const nextRun = new Date(job.nextRun);
      return nextRun <= now;
    });
  }

  // Calculate next run time
  private calculateNextRun(schedule: ScheduledJob["schedule"]): string {
    const now = new Date();
    const next = new Date(now);
    next.setUTCHours(schedule.hour, schedule.minute, 0, 0);

    if (schedule.frequency === "once") {
      if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
      return next.toISOString();
    }

    if (schedule.frequency === "daily") {
      if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
      return next.toISOString();
    }

    if (schedule.frequency === "weekly") {
      const targetDay = schedule.dayOfWeek ?? 1; // Monday default
      const currentDay = next.getUTCDay();
      let daysAhead = targetDay - currentDay;
      if (daysAhead < 0 || (daysAhead === 0 && next <= now)) {
        daysAhead += 7;
      }
      next.setUTCDate(next.getUTCDate() + daysAhead);
      return next.toISOString();
    }

    if (schedule.frequency === "biweekly") {
      const targetDay = schedule.dayOfWeek ?? 1;
      const currentDay = next.getUTCDay();
      let daysAhead = targetDay - currentDay;
      if (daysAhead < 0 || (daysAhead === 0 && next <= now)) {
        daysAhead += 14;
      }
      next.setUTCDate(next.getUTCDate() + daysAhead);
      return next.toISOString();
    }

    if (schedule.frequency === "monthly") {
      const targetDate = schedule.dayOfMonth ?? 1;
      next.setUTCDate(targetDate);
      if (next <= now) {
        next.setUTCMonth(next.getUTCMonth() + 1);
      }
      return next.toISOString();
    }

    return next.toISOString();
  }

  private getIntervalMs(frequency: string): number {
    switch (frequency) {
      case "daily": return 86400000;
      case "weekly": return 7 * 86400000;
      case "biweekly": return 14 * 86400000;
      case "monthly": return 30 * 86400000;
      default: return 7 * 86400000;
    }
  }
}
