// Content Marketing Strategy — ongoing content pipeline

import type { CampaignTemplate } from "../types";

export const contentMarketingTemplate: CampaignTemplate = {
  strategy: "content-marketing",
  name: "Content Marketing Campaign",
  description: "Create SEO-optimized blog content with social distribution",
  requiredInputs: ["topic"],
  estimatedDuration: "1-2 days",
  defaultSteps: [
    {
      name: "Keyword Research",
      description: "Find optimal keywords and content angle",
      agent: "writer",
      action: "keyword-research",
      input: {},
      dependsOn: [],
    },
    {
      name: "SERP Analysis",
      description: "Analyze top-ranking content to find gaps",
      agent: "writer",
      action: "serp-analysis",
      input: {},
      dependsOn: [],
    },
    {
      name: "Topic Research",
      description: "Research the topic for accurate, up-to-date content",
      agent: "researcher",
      action: "research",
      input: { depth: "deep" },
      dependsOn: [],
    },
    {
      name: "Write Blog Post",
      description: "Write SEO-optimized blog post using research and keyword data",
      agent: "writer",
      action: "write-blog",
      input: {},
      dependsOn: ["step_1", "step_2", "step_3"],
    },
    {
      name: "Editorial Review",
      description: "Review for quality, grammar, and SEO optimization",
      agent: "editor",
      action: "edit",
      input: {},
      dependsOn: ["step_4"],
    },
    {
      name: "SEO Optimization",
      description: "Final SEO pass with keyword optimization",
      agent: "editor",
      action: "seo-optimize",
      input: {},
      dependsOn: ["step_5"],
    },
    {
      name: "Social Media Posts",
      description: "Create social posts from the blog content",
      agent: "social-writer",
      action: "blog-to-social",
      input: {},
      dependsOn: ["step_5"],
    },
    {
      name: "Publish",
      description: "Publish blog and social posts",
      agent: "publisher",
      action: "publish",
      input: {},
      dependsOn: ["step_6", "step_7"],
    },
  ],
};
