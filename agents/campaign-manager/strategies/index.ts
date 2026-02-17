// Strategy registry — add new strategies here

import type { CampaignTemplate, CampaignStrategy } from "../types";
import { productLaunchTemplate } from "./product-launch";
import { contentMarketingTemplate } from "./content-marketing";
import { socialBlitzTemplate } from "./social-blitz";

const strategies: Map<CampaignStrategy, CampaignTemplate> = new Map([
  ["product-launch", productLaunchTemplate],
  ["content-marketing", contentMarketingTemplate],
  ["social-blitz", socialBlitzTemplate],
  // Add new strategies here:
  // ["email-nurture", emailNurtureTemplate],
  // ["seo-domination", seoDominationTemplate],
  // ["competitor-counter", competitorCounterTemplate],
]);

export function getStrategy(name: CampaignStrategy): CampaignTemplate | undefined {
  return strategies.get(name);
}

export function listStrategies(): CampaignTemplate[] {
  return Array.from(strategies.values());
}

export function getStrategyNames(): CampaignStrategy[] {
  return Array.from(strategies.keys());
}
