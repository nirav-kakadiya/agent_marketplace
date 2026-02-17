// Scheduler Agent — manages recurring jobs and content calendar
// Simplified version — handles cron-like scheduling for campaigns

import { BaseAgent } from "../../core/agent";
import { createMessage, type Message, type TaskPayload, type ResultPayload } from "../../core/message";
import type { Memory } from "../../core/memory";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";

export interface ScheduledJob {
  id: string;
  name: string;
  request: string;
  schedule: {
    frequency: "once" | "daily" | "weekly" | "monthly";
    dayOfWeek?: number;
    hour: number;
    minute: number;
  };
  platforms?: string[];
  enabled: boolean;
  lastRun?: string;
  nextRun: string;
  runCount: number;
  createdAt: string;
}

export class SchedulerAgent extends BaseAgent {
  private memory: Memory;
  private dataDir: string;
  private jobs: Map<string, ScheduledJob> = new Map();
  private tickerInterval?: ReturnType<typeof setInterval>;
  private onJobDue?: (job: ScheduledJob) => Promise<void>;

  constructor(memory: Memory, dataDir: string) {
    super({
      name: "scheduler",
      description: "Schedules recurring content generation and campaign execution",
      version: "2.0.0",
      capabilities: [
        {
          name: "schedule",
          description: "Create a recurring content schedule",
          inputSchema: { request: "string", frequency: "string", hour: "number?" },
          outputSchema: { job: "object" },
        },
        {
          name: "list-jobs",
          description: "List all scheduled jobs",
          inputSchema: {},
          outputSchema: { jobs: "object[]" },
        },
        {
          name: "cancel-job",
          description: "Cancel a scheduled job",
          inputSchema: { jobId: "string" },
          outputSchema: { success: "boolean" },
        },
      ],
    });
    this.memory = memory;
    this.dataDir = dataDir;
  }

  async init() {
    await mkdir(this.dataDir, { recursive: true });
    await this.loadJobs();
  }

  startTicker(onJobDue: (job: ScheduledJob) => Promise<void>) {
    this.onJobDue = onJobDue;
    this.tickerInterval = setInterval(() => this.tick(), 60000); // check every minute
    console.log("⏰ Scheduler ticker started");
  }

  stopTicker() {
    if (this.tickerInterval) clearInterval(this.tickerInterval);
  }

  async handle(message: Message): Promise<Message> {
    const task = message.payload as TaskPayload;

    try {
      let output: any;

      switch (task.action) {
        case "schedule":
          output = await this.createJob(task.input);
          break;
        case "list-jobs":
          output = { jobs: Array.from(this.jobs.values()) };
          break;
        case "cancel-job":
          output = this.cancelJob(task.input.jobId);
          break;
        default:
          output = await this.createJob(task.input);
      }

      return createMessage(this.name, message.from, "result", {
        success: true,
        output,
      } satisfies ResultPayload, message.id);
    } catch (err: any) {
      return createMessage(this.name, message.from, "error", {
        code: "SCHEDULER_ERROR",
        message: err.message,
        retryable: false,
      }, message.id);
    }
  }

  private async createJob(input: any): Promise<ScheduledJob> {
    const id = `job_${Date.now()}`;
    const job: ScheduledJob = {
      id,
      name: input.name || input.request?.slice(0, 50) || "Untitled",
      request: input.request || input.topic,
      schedule: {
        frequency: input.frequency || "weekly",
        dayOfWeek: input.dayOfWeek,
        hour: input.hour ?? 9,
        minute: input.minute ?? 0,
      },
      platforms: input.platforms,
      enabled: true,
      nextRun: this.calculateNextRun(input),
      runCount: 0,
      createdAt: new Date().toISOString(),
    };

    this.jobs.set(id, job);
    await this.saveJobs();
    return job;
  }

  private cancelJob(jobId: string) {
    const deleted = this.jobs.delete(jobId);
    if (deleted) this.saveJobs();
    return { success: deleted };
  }

  private async tick() {
    const now = new Date();
    for (const job of this.jobs.values()) {
      if (!job.enabled) continue;
      if (new Date(job.nextRun) <= now) {
        try {
          if (this.onJobDue) await this.onJobDue(job);
          job.lastRun = now.toISOString();
          job.runCount++;
          job.nextRun = this.calculateNextRun(job.schedule);
          if (job.schedule.frequency === "once") job.enabled = false;
          await this.saveJobs();
        } catch (err: any) {
          console.error(`Scheduler error for ${job.id}: ${err.message}`);
        }
      }
    }
  }

  private calculateNextRun(schedule: any): string {
    const now = new Date();
    const next = new Date(now);
    next.setHours(schedule.hour ?? 9, schedule.minute ?? 0, 0, 0);

    if (next <= now) {
      switch (schedule.frequency) {
        case "daily": next.setDate(next.getDate() + 1); break;
        case "weekly": next.setDate(next.getDate() + 7); break;
        case "monthly": next.setMonth(next.getMonth() + 1); break;
        default: next.setDate(next.getDate() + 1);
      }
    }
    return next.toISOString();
  }

  private async loadJobs() {
    try {
      const data = await readFile(join(this.dataDir, "jobs.json"), "utf-8");
      const list: ScheduledJob[] = JSON.parse(data);
      for (const j of list) this.jobs.set(j.id, j);
      console.log(`⏰ Scheduler: ${this.jobs.size} jobs loaded`);
    } catch {
      console.log("⏰ Scheduler: no jobs");
    }
  }

  private async saveJobs() {
    await writeFile(join(this.dataDir, "jobs.json"), JSON.stringify(Array.from(this.jobs.values()), null, 2));
  }
}
