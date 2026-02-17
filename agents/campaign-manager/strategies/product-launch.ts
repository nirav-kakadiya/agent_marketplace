// Product Launch Strategy — full launch campaign

import type { CampaignTemplate } from "../types";

export const productLaunchTemplate: CampaignTemplate = {
  strategy: "product-launch",
  name: "Product Launch Campaign",
  description: "Full product launch — research, content, social, scheduling, monitoring",
  requiredInputs: ["productName", "productUrl", "launchDate", "category"],
  estimatedDuration: "5-7 days",
  defaultSteps: [
    {
      name: "Market Research",
      description: "Research competitors, market landscape, and successful launches in the category",
      agent: "researcher",
      action: "research",
      input: { depth: "deep" },
      dependsOn: [],
    },
    {
      name: "Competitor Analysis",
      description: "Deep-dive into competitor launches and positioning",
      agent: "researcher",
      action: "competitor-analysis",
      input: {},
      dependsOn: [],
    },
    {
      name: "Launch Copy — Product Hunt",
      description: "Write PH tagline, description, first comment, maker story",
      agent: "writer",
      action: "write-blog",
      input: { wordCount: 800 },
      dependsOn: ["step_1", "step_2"],
    },
    {
      name: "Launch Blog Post",
      description: "Write announcement blog post with SEO optimization",
      agent: "writer",
      action: "write-blog",
      input: { wordCount: 1500 },
      dependsOn: ["step_1"],
    },
    {
      name: "Editorial Review",
      description: "Review all content for quality and brand consistency",
      agent: "editor",
      action: "edit",
      input: {},
      dependsOn: ["step_3", "step_4"],
    },
    {
      name: "Brand Consistency Check",
      description: "Ensure all content matches brand voice",
      agent: "brand-manager",
      action: "review-brand",
      input: {},
      dependsOn: ["step_5"],
    },
    {
      name: "Social Media Posts",
      description: "Create launch announcement posts for all platforms",
      agent: "social-writer",
      action: "write-social",
      input: { type: "product-launch" },
      dependsOn: ["step_4"],
    },
    {
      name: "Publish & Schedule",
      description: "Publish blog and schedule social posts",
      agent: "publisher",
      action: "publish",
      input: {},
      dependsOn: ["step_6", "step_7"],
    },
  ],
};
