// E-commerce Agent — product listings, descriptions, pricing, competitor monitoring

import { BaseAgent } from "../../core/agent";
import { createMessage, type Message, type TaskPayload, type ResultPayload } from "../../core/message";
import { LLM, type LLMMessage } from "../../core/llm";
import { webSearch, type SearchConfig } from "../researcher/tools/web-search";

export class EcommerceAgent extends BaseAgent {
  private llm: LLM;
  private searchConfig: SearchConfig;

  constructor(llm: LLM, searchConfig: SearchConfig) {
    super({
      name: "ecommerce-agent",
      description: "E-commerce optimization — product descriptions, pricing analysis, competitor monitoring, listing optimization",
      version: "1.0.0",
      capabilities: [
        { name: "product-description", description: "Write SEO-optimized product descriptions", inputSchema: { product: "string", features: "string[]?", audience: "string?" }, outputSchema: { description: "object" } },
        { name: "bulk-descriptions", description: "Generate descriptions for multiple products", inputSchema: { products: "object[]" }, outputSchema: { descriptions: "object[]" } },
        { name: "pricing-analysis", description: "Analyze competitor pricing", inputSchema: { product: "string", currentPrice: "number?" }, outputSchema: { analysis: "object" } },
        { name: "listing-optimize", description: "Optimize product listing for marketplace SEO", inputSchema: { title: "string", description: "string", platform: "string?" }, outputSchema: { optimized: "object" } },
        { name: "review-analyzer", description: "Analyze product reviews for insights", inputSchema: { reviews: "string[]", product: "string?" }, outputSchema: { analysis: "object" } },
        { name: "product-comparison", description: "Create product comparison content", inputSchema: { products: "string[]" }, outputSchema: { comparison: "object" } },
      ],
    });
    this.llm = llm;
    this.searchConfig = searchConfig;
  }

  async handle(message: Message): Promise<Message> {
    const task = message.payload as TaskPayload;
    try {
      let output: any;
      switch (task.action) {
        case "product-description": output = await this.productDescription(task.input); break;
        case "bulk-descriptions": output = await this.bulkDescriptions(task.input.products); break;
        case "pricing-analysis": output = await this.pricingAnalysis(task.input); break;
        case "listing-optimize": output = await this.listingOptimize(task.input); break;
        case "review-analyzer": output = await this.reviewAnalyzer(task.input); break;
        case "product-comparison": output = await this.productComparison(task.input.products); break;
        default: output = await this.productDescription(task.input);
      }
      return createMessage(this.name, message.from, "result", { success: true, output } satisfies ResultPayload, message.id);
    } catch (err: any) {
      return createMessage(this.name, message.from, "error", { code: "ECOM_ERROR", message: err.message, retryable: true }, message.id);
    }
  }

  private async productDescription(input: any): Promise<any> {
    const messages: LLMMessage[] = [
      { role: "system", content: `Write compelling, SEO-optimized product descriptions that convert. Output valid JSON.` },
      { role: "user", content: `Write product description:
Product: ${input.product}
${input.features ? `Features: ${input.features.join(", ")}` : ""}
${input.audience ? `Target audience: ${input.audience}` : ""}

Return JSON:
{
  "title": "SEO-optimized product title",
  "shortDescription": "50-word hook",
  "longDescription": "full description with benefits, features, use cases",
  "bulletPoints": ["key selling points"],
  "seoKeywords": [],
  "metaDescription": "",
  "tags": []
}` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { description: response.content }; }
  }

  private async bulkDescriptions(products: any[]): Promise<any> {
    const results: any[] = [];
    for (const product of products.slice(0, 20)) {
      const desc = await this.productDescription(typeof product === "string" ? { product } : product);
      results.push({ product: typeof product === "string" ? product : product.name, ...desc });
    }
    return { descriptions: results, count: results.length };
  }

  private async pricingAnalysis(input: any): Promise<any> {
    const results = await webSearch(`${input.product} price buy`, this.searchConfig, 10);
    const messages: LLMMessage[] = [
      { role: "system", content: `Analyze competitor pricing and provide recommendations. Output valid JSON.` },
      { role: "user", content: `Pricing analysis for: ${input.product}
${input.currentPrice ? `Current price: $${input.currentPrice}` : ""}

Competitor listings:
${results.map(r => `- ${r.title}: ${r.snippet}`).join("\n")}

Return JSON:
{
  "product": "${input.product}",
  "competitorPrices": [{ "competitor": "", "price": "", "url": "" }],
  "priceRange": { "low": 0, "average": 0, "high": 0 },
  "recommendation": { "suggestedPrice": 0, "reasoning": "", "strategy": "premium|competitive|penetration" },
  "insights": []
}` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { analysis: response.content }; }
  }

  private async listingOptimize(input: any): Promise<any> {
    const messages: LLMMessage[] = [
      { role: "system", content: `Optimize product listings for marketplace search. Output valid JSON.` },
      { role: "user", content: `Optimize this listing:
Platform: ${input.platform || "general"}
Title: ${input.title}
Description: ${input.description}

Return JSON:
{
  "optimizedTitle": "",
  "optimizedDescription": "",
  "bulletPoints": [],
  "searchTerms": [],
  "backendKeywords": [],
  "improvements": [],
  "score": { "before": 0, "after": 0 }
}` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { optimized: response.content }; }
  }

  private async reviewAnalyzer(input: any): Promise<any> {
    const messages: LLMMessage[] = [
      { role: "system", content: `Analyze product reviews for actionable insights. Output valid JSON.` },
      { role: "user", content: `Analyze these reviews${input.product ? ` for ${input.product}` : ""}:
${input.reviews.slice(0, 20).map((r: string, i: number) => `${i + 1}. "${r}"`).join("\n")}

Return JSON:
{
  "summary": "",
  "sentiment": { "positive": 0, "neutral": 0, "negative": 0 },
  "topPraises": [],
  "topComplaints": [],
  "featureRequests": [],
  "competitorMentions": [],
  "actionItems": [{ "priority": "high|medium|low", "action": "", "reason": "" }]
}` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { analysis: response.content }; }
  }

  private async productComparison(products: string[]): Promise<any> {
    const allResults: any[] = [];
    for (const p of products.slice(0, 5)) {
      const results = await webSearch(`${p} review features pricing`, this.searchConfig, 3);
      allResults.push({ product: p, results });
    }

    const messages: LLMMessage[] = [
      { role: "system", content: `Create a comprehensive product comparison. Output valid JSON.` },
      { role: "user", content: `Compare these products: ${products.join(" vs ")}

Research:
${allResults.map(a => `${a.product}:\n${a.results.map((r: any) => `  - ${r.title}: ${r.snippet}`).join("\n")}`).join("\n\n")}

Return JSON:
{
  "products": ${JSON.stringify(products)},
  "comparison": [{ "feature": "", ${products.map(p => `"${p}": ""`).join(", ")} }],
  "winner": { "overall": "", "bestValue": "", "bestFeatures": "", "easiest": "" },
  "summary": "",
  "blogContent": "full comparison article in markdown"
}` },
    ];
    const response = await this.llm.chat(messages);
    try { return JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
    catch { return { comparison: response.content }; }
  }
}
