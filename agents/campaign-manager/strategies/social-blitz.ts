// Social Blitz Strategy — rapid multi-platform social campaign

import type { CampaignTemplate } from "../types";

export const socialBlitzTemplate: CampaignTemplate = {
  strategy: "social-blitz",
  name: "Social Media Blitz",
  description: "Rapid multi-platform social media push for maximum visibility",
  requiredInputs: ["topic", "platforms"],
  estimatedDuration: "2-4 hours",
  defaultSteps: [
    {
      name: "Trend Research",
      description: "Find trending angles and hashtags",
      agent: "researcher",
      action: "trend-research",
      input: {},
      dependsOn: [],
    },
    {
      name: "Create Social Content",
      description: "Write platform-specific posts leveraging trends",
      agent: "social-writer",
      action: "write-social",
      input: {},
      dependsOn: ["step_1"],
    },
    {
      name: "Brand Review",
      description: "Quick brand consistency check",
      agent: "brand-manager",
      action: "review-brand",
      input: {},
      dependsOn: ["step_2"],
    },
    {
      name: "Publish All",
      description: "Publish to all platforms",
      agent: "publisher",
      action: "publish",
      input: {},
      dependsOn: ["step_3"],
    },
  ],
};
