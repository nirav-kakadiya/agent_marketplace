// Campaign types — the heart of what makes this an AGENT

export type CampaignStrategy =
  | "product-launch"
  | "content-marketing"
  | "social-blitz"
  | "email-nurture"
  | "seo-domination"
  | "competitor-counter";

export type CampaignStatus = "planning" | "active" | "paused" | "completed" | "failed";
export type StepStatus = "pending" | "running" | "done" | "failed" | "skipped";

export interface Campaign {
  id: string;
  name: string;
  strategy: CampaignStrategy;
  status: CampaignStatus;
  request: string;              // Original user request

  plan: CampaignPlan;
  currentStep: number;
  results: StepResult[];

  // Config
  tenantId?: string;
  platforms: string[];

  // Timing
  startDate: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;

  // Progress tracking
  progress: number;             // 0-100
  logs: CampaignLog[];
}

export interface CampaignPlan {
  steps: CampaignStep[];
  timeline: string;
  kpis: string[];
  estimatedDuration: string;
}

export interface CampaignStep {
  id: string;
  name: string;
  description: string;
  agent: string;                // which agent handles this
  action: string;               // agent action to call
  input: Record<string, any>;   // input for the agent
  dependsOn: string[];          // step IDs that must complete first
  scheduledAt?: string;         // when to execute (for future steps)
  status: StepStatus;
  output?: any;                 // result from execution
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface StepResult {
  stepId: string;
  stepName: string;
  agent: string;
  status: StepStatus;
  output: any;
  duration: number;             // ms
  timestamp: string;
}

export interface CampaignLog {
  timestamp: string;
  level: "info" | "warn" | "error" | "success";
  message: string;
  stepId?: string;
}

export interface CampaignTemplate {
  strategy: CampaignStrategy;
  name: string;
  description: string;
  defaultSteps: Omit<CampaignStep, "id" | "status" | "output">[];
  requiredInputs: string[];
  estimatedDuration: string;
}
