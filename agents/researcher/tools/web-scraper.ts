// Web Scraper — fetch and extract readable content from URLs

export interface ScrapedPage {
  url: string;
  title: string;
  content: string;
  wordCount: number;
  headings: string[];
}

export async function scrapePage(url: string, maxChars: number = 15000): Promise<ScrapedPage> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; AgentMarketplace/1.0)",
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);

  const html = await res.text();
  return parseHTML(url, html, maxChars);
}

export async function scrapeMultiple(urls: string[], maxChars: number = 10000): Promise<ScrapedPage[]> {
  const results: ScrapedPage[] = [];
  for (const url of urls.slice(0, 5)) {
    try {
      const page = await scrapePage(url, maxChars);
      results.push(page);
    } catch (err: any) {
      results.push({ url, title: "", content: `[Error: ${err.message}]`, wordCount: 0, headings: [] });
    }
  }
  return results;
}

function parseHTML(url: string, html: string, maxChars: number): ScrapedPage {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1].trim()) : "";

  // Extract headings
  const headings: string[] = [];
  const headingRegex = /<h[1-3][^>]*>([^<]+)<\/h[1-3]>/gi;
  let hMatch;
  while ((hMatch = headingRegex.exec(html)) !== null) {
    headings.push(decodeEntities(hMatch[1].trim()));
  }

  // Strip scripts, styles, nav, footer, header
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  // Try to find main content
  const mainMatch = cleaned.match(/<(?:main|article)[^>]*>([\s\S]*?)<\/(?:main|article)>/i);
  if (mainMatch) cleaned = mainMatch[1];

  // Strip remaining HTML tags
  let text = cleaned
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  text = decodeEntities(text);

  // Truncate
  if (text.length > maxChars) {
    text = text.slice(0, maxChars) + "...";
  }

  const wordCount = text.split(/\s+/).length;

  return { url, title, content: text, wordCount, headings };
}

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/");
}
