// Webhook Notifications — notify users when async tasks complete
// Campaign finished, content generated, error occurred

import { createHash, createHmac } from "crypto";

export interface WebhookConfig {
  url: string;
  secret?: string; // for HMAC signature verification
  events: string[]; // which events to send
  active: boolean;
}

export interface WebhookPayload {
  event: string;
  tenantId: string;
  timestamp: string;
  data: any;
}

// Supported webhook events
export const WEBHOOK_EVENTS = [
  "campaign.completed",
  "campaign.step.completed",
  "campaign.failed",
  "content.generated",
  "content.published",
  "usage.limit.warning",  // 80% of limit reached
  "usage.limit.reached",  // 100% hit
  "error",
] as const;

export type WebhookEvent = typeof WEBHOOK_EVENTS[number];

export class WebhookManager {
  private webhooks: Map<string, WebhookConfig[]> = new Map(); // tenantId → webhooks

  // Register a webhook for a tenant
  register(tenantId: string, config: WebhookConfig): void {
    const existing = this.webhooks.get(tenantId) || [];
    existing.push(config);
    this.webhooks.set(tenantId, existing);
  }

  // Remove a webhook
  remove(tenantId: string, url: string): boolean {
    const existing = this.webhooks.get(tenantId) || [];
    const filtered = existing.filter(w => w.url !== url);
    this.webhooks.set(tenantId, filtered);
    return filtered.length < existing.length;
  }

  // List webhooks for a tenant
  list(tenantId: string): WebhookConfig[] {
    return (this.webhooks.get(tenantId) || []).map(w => ({
      ...w,
      secret: w.secret ? "***" : undefined, // never expose secret
    }));
  }

  // Fire a webhook event
  async fire(tenantId: string, event: WebhookEvent, data: any): Promise<{ sent: number; failed: number }> {
    const hooks = (this.webhooks.get(tenantId) || []).filter(
      w => w.active && (w.events.includes("*") || w.events.includes(event))
    );

    let sent = 0;
    let failed = 0;

    for (const hook of hooks) {
      try {
        const payload: WebhookPayload = {
          event,
          tenantId,
          timestamp: new Date().toISOString(),
          data,
        };

        const body = JSON.stringify(payload);
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "X-Webhook-Event": event,
          "X-Webhook-Timestamp": payload.timestamp,
        };

        // Sign payload with HMAC if secret is configured
        if (hook.secret) {
          const signature = createHmac("sha256", hook.secret).update(body).digest("hex");
          headers["X-Webhook-Signature"] = `sha256=${signature}`;
        }

        const response = await fetch(hook.url, {
          method: "POST",
          headers,
          body,
          signal: AbortSignal.timeout(10000), // 10s timeout
        });

        if (response.ok) {
          sent++;
        } else {
          console.error(`⚠️ Webhook failed for ${tenantId}: ${hook.url} → ${response.status}`);
          failed++;
        }
      } catch (err: any) {
        console.error(`⚠️ Webhook error for ${tenantId}: ${hook.url} → ${err.message}`);
        failed++;
      }
    }

    return { sent, failed };
  }

  // Fire usage warning when approaching limit
  async checkUsageWarning(tenantId: string, current: number, limit: number): Promise<void> {
    if (limit <= 0) return; // unlimited
    const percent = (current / limit) * 100;

    if (percent >= 100) {
      await this.fire(tenantId, "usage.limit.reached", {
        current, limit, percent: 100,
        message: `You've reached your monthly limit of ${limit} requests.`,
      });
    } else if (percent >= 80) {
      await this.fire(tenantId, "usage.limit.warning", {
        current, limit, percent: Math.round(percent),
        message: `You've used ${Math.round(percent)}% of your monthly limit (${current}/${limit}).`,
      });
    }
  }
}
