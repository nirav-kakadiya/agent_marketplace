// === Docs Navigation & Content ===
const sections = {
intro: `
<h1>Agent Marketplace</h1>
<p>A production-ready platform of 19 autonomous AI marketing agents. Each agent specializes in a different aspect of the content pipeline — from research and writing to SEO optimization and multi-platform publishing.</p>
<h2>Key Features</h2>
<ul>
  <li><strong>19 specialized agents</strong> — each with distinct capabilities</li>
  <li><strong>Orchestrator</strong> — coordinates multi-agent workflows</li>
  <li><strong>Campaign management</strong> — automated content pipelines</li>
  <li><strong>Multi-tenant</strong> — usage tracking and billing per tenant</li>
  <li><strong>RESTful API</strong> — integrate with any application</li>
  <li><strong>Webhooks</strong> — real-time event notifications</li>
</ul>
<h2>Architecture</h2>
<p>The platform runs as a single Hono-based HTTP server. Agents communicate through an internal message bus. All state is in-memory with optional persistence.</p>
<pre><code>Client → HTTP API → Message Bus → Agent → LLM → Response</code></pre>
`,

quickstart: `
<h1>Quickstart</h1>
<h2>1. Clone & Install</h2>
<pre><code>git clone https://github.com/nirav-kakadiya/agent_marketplace.git
cd agent_marketplace
bun install</code></pre>
<h2>2. Configure</h2>
<pre><code># Set your LLM provider key
export LLM_API_KEY=sk-your-key-here

# Optional: configure integrations
export BRAVE_API_KEY=...
export WP_URL=...</code></pre>
<h2>3. Start</h2>
<pre><code>bun run server.ts</code></pre>
<p>Server starts on <code>http://localhost:3000</code>. Open the dashboard at <code>/dashboard.html</code>.</p>
<h2>4. Test</h2>
<pre><code>curl http://localhost:3000/api/v1/health

curl -X POST http://localhost:3000/api/v1/run \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{"agent":"writer","task":"write a blog post about AI trends"}'</code></pre>
`,

auth: `
<h1>Authentication</h1>
<p>All API endpoints (except <code>/health</code> and <code>/setup</code>) require authentication.</p>
<h2>Bearer Token</h2>
<p>Include your API key in the Authorization header:</p>
<pre><code>Authorization: Bearer sk_your_api_key</code></pre>
<h2>Getting an API Key</h2>
<p>API keys are generated when creating a tenant:</p>
<pre><code>curl -X POST /api/v1/tenants \\
  -H "Content-Type: application/json" \\
  -d '{"name":"My Company","email":"me@example.com","plan":"starter"}'

# Response includes apiKey field</code></pre>
<h2>Server-Level Key</h2>
<p>The <code>LLM_API_KEY</code> environment variable serves as the master key. This is the key used for the LLM provider and also accepted as an auth token.</p>
`,

'api-agents': `
<h1>Agents API</h1>
<div class="endpoint">
  <span class="endpoint-method method-get">GET</span>
  <span class="endpoint-path">/api/v1/agents</span>
  <p class="endpoint-desc">List all available agents with their capabilities.</p>
</div>
<h3>Response</h3>
<pre><code>{
  "agents": [
    {
      "name": "writer",
      "description": "Long-form content generation agent",
      "version": "1.0",
      "capabilities": ["blog-post", "article", "landing-page", ...]
    }
  ]
}</code></pre>
<div class="endpoint">
  <span class="endpoint-method method-get">GET</span>
  <span class="endpoint-path">/api/v1/setup/agent/:name</span>
  <p class="endpoint-desc">Check setup status for a specific agent.</p>
</div>
`,

'api-run': `
<h1>Run Agent</h1>
<div class="endpoint">
  <span class="endpoint-method method-post">POST</span>
  <span class="endpoint-path">/api/v1/run</span>
  <p class="endpoint-desc">Execute an agent task. This is the primary endpoint for interacting with agents.</p>
</div>
<h3>Request Body</h3>
<pre><code>{
  "agent": "writer",           // Required: agent name
  "task": "write a blog post", // Required: task description
  "input": {},                 // Optional: additional parameters
  "tenantId": "t_123"          // Optional: for usage tracking
}</code></pre>
<h3>Response</h3>
<pre><code>{
  "status": "complete",
  "agent": "writer",
  "output": "# My Blog Post\\n\\n...",
  "metadata": {
    "tokens": 1523,
    "latency": 2340
  }
}</code></pre>
<div class="endpoint">
  <span class="endpoint-method method-post">POST</span>
  <span class="endpoint-path">/api/v1/generate</span>
  <p class="endpoint-desc">Generate content (alias for run with writer agent).</p>
</div>
<div class="endpoint">
  <span class="endpoint-method method-post">POST</span>
  <span class="endpoint-path">/api/v1/research</span>
  <p class="endpoint-desc">Run a research task using the researcher agent.</p>
</div>
<div class="endpoint">
  <span class="endpoint-method method-post">POST</span>
  <span class="endpoint-path">/api/v1/seo/keywords</span>
  <p class="endpoint-desc">Generate SEO keyword suggestions.</p>
</div>
`,

'api-campaigns': `
<h1>Campaigns API</h1>
<div class="endpoint">
  <span class="endpoint-method method-post">POST</span>
  <span class="endpoint-path">/api/v1/campaigns</span>
  <p class="endpoint-desc">Create a new campaign.</p>
</div>
<h3>Request</h3>
<pre><code>{
  "name": "Q1 Content Push",
  "strategy": "content-marketing",
  "config": {}
}</code></pre>
<div class="endpoint">
  <span class="endpoint-method method-get">GET</span>
  <span class="endpoint-path">/api/v1/campaigns</span>
  <p class="endpoint-desc">List all campaigns.</p>
</div>
<div class="endpoint">
  <span class="endpoint-method method-get">GET</span>
  <span class="endpoint-path">/api/v1/campaigns/:id</span>
  <p class="endpoint-desc">Get campaign details.</p>
</div>
<div class="endpoint">
  <span class="endpoint-method method-post">POST</span>
  <span class="endpoint-path">/api/v1/campaigns/:id/run</span>
  <p class="endpoint-desc">Execute a campaign step.</p>
</div>
<div class="endpoint">
  <span class="endpoint-method method-post">POST</span>
  <span class="endpoint-path">/api/v1/campaigns/:id/pause</span>
  <p class="endpoint-desc">Pause a running campaign.</p>
</div>
`,

'api-tenants': `
<h1>Tenants API</h1>
<p>Multi-tenant support with per-tenant usage tracking and billing.</p>
<div class="endpoint">
  <span class="endpoint-method method-post">POST</span>
  <span class="endpoint-path">/api/v1/tenants</span>
  <p class="endpoint-desc">Create a new tenant. Returns an API key.</p>
</div>
<pre><code>// Request
{ "name": "Acme Corp", "email": "admin@acme.com", "plan": "pro" }

// Response
{ "id": "t_abc123", "apiKey": "sk_...", "name": "Acme Corp", "plan": "pro" }</code></pre>
<div class="endpoint">
  <span class="endpoint-method method-get">GET</span>
  <span class="endpoint-path">/api/v1/tenants</span>
  <p class="endpoint-desc">List all tenants.</p>
</div>
<div class="endpoint">
  <span class="endpoint-method method-get">GET</span>
  <span class="endpoint-path">/api/v1/tenants/:id/dashboard</span>
  <p class="endpoint-desc">Get tenant dashboard data with usage statistics.</p>
</div>
<div class="endpoint">
  <span class="endpoint-method method-get">GET</span>
  <span class="endpoint-path">/api/v1/tenants/:id/usage</span>
  <p class="endpoint-desc">Get detailed usage data for a tenant.</p>
</div>
<div class="endpoint">
  <span class="endpoint-method method-get">GET</span>
  <span class="endpoint-path">/api/v1/tenants/:id/export</span>
  <p class="endpoint-desc">Export tenant data.</p>
</div>
`,

'api-other': `
<h1>Other Endpoints</h1>
<div class="endpoint">
  <span class="endpoint-method method-get">GET</span>
  <span class="endpoint-path">/api/v1/health</span>
  <p class="endpoint-desc">Health check. No auth required.</p>
</div>
<div class="endpoint">
  <span class="endpoint-method method-get">GET</span>
  <span class="endpoint-path">/api/v1/config</span>
  <p class="endpoint-desc">Get server configuration (features, limits).</p>
</div>
<div class="endpoint">
  <span class="endpoint-method method-get">GET</span>
  <span class="endpoint-path">/api/v1/setup</span>
  <p class="endpoint-desc">Check server setup status. No auth required.</p>
</div>
<div class="endpoint">
  <span class="endpoint-method method-get">GET</span>
  <span class="endpoint-path">/api/v1/strategies</span>
  <p class="endpoint-desc">List available campaign strategies.</p>
</div>
<div class="endpoint">
  <span class="endpoint-method method-get">GET</span>
  <span class="endpoint-path">/api/v1/cache/stats</span>
  <p class="endpoint-desc">Get prompt cache statistics.</p>
</div>
<div class="endpoint">
  <span class="endpoint-method method-post">POST</span>
  <span class="endpoint-path">/api/v1/cache/invalidate</span>
  <p class="endpoint-desc">Invalidate the prompt cache.</p>
</div>
<div class="endpoint">
  <span class="endpoint-method method-post">POST</span>
  <span class="endpoint-path">/api/v1/auth/login</span>
  <p class="endpoint-desc">Authenticate and get a session token.</p>
</div>
`,

'agents-catalog': `
<h1>Agent Catalog</h1>
<p>All 19 agents and their specializations.</p>
<table>
<thead><tr><th>Agent</th><th>Role</th><th>Key Capabilities</th></tr></thead>
<tbody>
<tr><td>🎯 orchestrator</td><td>Workflow coordinator</td><td>Multi-agent pipelines, task routing</td></tr>
<tr><td>🔍 researcher</td><td>Research & analysis</td><td>Web research, topic analysis, competitor research</td></tr>
<tr><td>✍️ writer</td><td>Content creation</td><td>Blog posts, articles, landing pages, scripts</td></tr>
<tr><td>📝 editor</td><td>Quality assurance</td><td>Grammar, style, fact-checking, tone</td></tr>
<tr><td>📤 publisher</td><td>Distribution</td><td>WordPress, CMS, multi-platform publishing</td></tr>
<tr><td>💬 social-writer</td><td>Social content</td><td>Tweets, LinkedIn posts, captions</td></tr>
<tr><td>🎨 brand-manager</td><td>Brand consistency</td><td>Voice guidelines, brand audit, messaging</td></tr>
<tr><td>📅 scheduler</td><td>Timing & calendar</td><td>Content calendar, optimal timing</td></tr>
<tr><td>📊 analytics</td><td>Performance</td><td>Metrics tracking, reporting, insights</td></tr>
<tr><td>📋 campaign-manager</td><td>Campaign ops</td><td>Strategy, execution, A/B testing</td></tr>
<tr><td>♻️ content-repurposer</td><td>Content adaptation</td><td>Format conversion, platform optimization</td></tr>
<tr><td>📈 data-analyst</td><td>Data insights</td><td>Trend analysis, forecasting, reporting</td></tr>
<tr><td>⚙️ devops</td><td>Infrastructure</td><td>Deployment, monitoring, CI/CD</td></tr>
<tr><td>🛒 ecommerce</td><td>Product content</td><td>Product descriptions, store optimization</td></tr>
<tr><td>📧 email-marketing</td><td>Email campaigns</td><td>Sequences, newsletters, drip campaigns</td></tr>
<tr><td>🔎 seo</td><td>Search optimization</td><td>Keywords, meta tags, content optimization</td></tr>
<tr><td>📱 social-media-manager</td><td>Social strategy</td><td>Scheduling, engagement, growth</td></tr>
<tr><td>🖌️ brand-design</td><td>Visual assets</td><td>Brand guidelines, visual identity</td></tr>
<tr><td>💼 sales</td><td>Sales enablement</td><td>Sales copy, outreach, proposals</td></tr>
</tbody>
</table>
`,

webhooks: `
<h1>Webhooks</h1>
<p>Get real-time notifications when events occur in your marketplace.</p>
<h2>Setup</h2>
<pre><code>curl -X POST /api/v1/tenants/:id/webhooks \\
  -H "Authorization: Bearer sk_..." \\
  -d '{
    "url": "https://your-app.com/webhook",
    "events": ["agent.complete", "campaign.step", "error"]
  }'</code></pre>
<h2>Events</h2>
<table>
<thead><tr><th>Event</th><th>Description</th></tr></thead>
<tbody>
<tr><td><code>agent.complete</code></td><td>Agent finished a task</td></tr>
<tr><td><code>agent.error</code></td><td>Agent encountered an error</td></tr>
<tr><td><code>campaign.step</code></td><td>Campaign step completed</td></tr>
<tr><td><code>campaign.complete</code></td><td>Entire campaign finished</td></tr>
<tr><td><code>content.published</code></td><td>Content published to a platform</td></tr>
</tbody>
</table>
<h2>Payload Format</h2>
<pre><code>{
  "event": "agent.complete",
  "timestamp": "2025-01-15T10:30:00Z",
  "data": {
    "agent": "writer",
    "taskId": "task_abc",
    "status": "complete",
    "output": "..."
  }
}</code></pre>
`,

faq: `
<h1>FAQ</h1>
<h3>What LLM providers are supported?</h3>
<p>Any OpenAI-compatible API works. We recommend OpenRouter for multi-model access, or direct connections to Anthropic, OpenAI, or Google AI.</p>
<h3>How does billing work?</h3>
<p>The platform supports hybrid billing. You pay for your LLM API usage directly to the provider. The marketplace itself can be self-hosted for free or used as a managed service with per-tenant billing.</p>
<h3>Can agents collaborate?</h3>
<p>Yes. The orchestrator agent can coordinate multi-agent workflows. For example: researcher → writer → editor → publisher is a common pipeline.</p>
<h3>Is there rate limiting?</h3>
<p>Rate limits are configurable per tenant plan in <code>config.json</code>. Set <code>-1</code> for unlimited.</p>
<h3>Can I add custom agents?</h3>
<p>Yes. Create a new agent class extending the base agent, register it with the message bus in <code>server.ts</code>, and it will be automatically available via the API.</p>
<h3>How do I deploy to production?</h3>
<p>The server runs on Bun. Deploy anywhere that supports Node.js or Bun runtimes. Use a process manager like PM2 or systemd, and put it behind a reverse proxy (nginx, Caddy) for TLS.</p>
`
};

function showSection(id) {
  const content = document.getElementById('docsContent');
  content.innerHTML = sections[id] || '<p>Section not found.</p>';
  document.querySelectorAll('.docs-nav-link').forEach(l => {
    l.classList.toggle('active', l.dataset.section === id);
  });
  location.hash = id;
  content.scrollTop = 0;
}

// Init from hash or default
const initSection = location.hash.slice(1) || 'intro';
showSection(sections[initSection] ? initSection : 'intro');

window.addEventListener('hashchange', () => {
  const s = location.hash.slice(1);
  if (sections[s]) showSection(s);
});
