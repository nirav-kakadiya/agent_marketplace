// Web Search — actual search via Brave/Serper/Google APIs

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchConfig {
  provider: "brave" | "serper" | "google";
  apiKey: string;
}

export async function webSearch(query: string, config: SearchConfig, count: number = 10): Promise<SearchResult[]> {
  switch (config.provider) {
    case "brave":
      return bravSearch(query, config.apiKey, count);
    case "serper":
      return serperSearch(query, config.apiKey, count);
    case "google":
      return googleSearch(query, config.apiKey, count);
    default:
      throw new Error(`Unknown search provider: ${config.provider}`);
  }
}

async function bravSearch(query: string, apiKey: string, count: number): Promise<SearchResult[]> {
  const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`, {
    headers: { "X-Subscription-Token": apiKey, Accept: "application/json" },
  });
  const data: any = await res.json();
  if (!res.ok) throw new Error(data.message || `Brave search failed: ${res.status}`);

  return (data.web?.results || []).map((r: any) => ({
    title: r.title,
    url: r.url,
    snippet: r.description || "",
  }));
}

async function serperSearch(query: string, apiKey: string, count: number): Promise<SearchResult[]> {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, num: count }),
  });
  const data: any = await res.json();
  if (!res.ok) throw new Error(`Serper search failed: ${res.status}`);

  return (data.organic || []).map((r: any) => ({
    title: r.title,
    url: r.link,
    snippet: r.snippet || "",
  }));
}

async function googleSearch(query: string, apiKey: string, count: number): Promise<SearchResult[]> {
  // Google Custom Search API - requires both API key and CX (search engine ID)
  const [key, cx] = apiKey.split(":");
  const res = await fetch(
    `https://www.googleapis.com/customsearch/v1?key=${key}&cx=${cx}&q=${encodeURIComponent(query)}&num=${Math.min(count, 10)}`,
  );
  const data: any = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `Google search failed: ${res.status}`);

  return (data.items || []).map((r: any) => ({
    title: r.title,
    url: r.link,
    snippet: r.snippet || "",
  }));
}
