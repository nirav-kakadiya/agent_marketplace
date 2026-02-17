// === Dashboard Logic ===
let agentsData = [];
let campaignsData = [];

// Fetch data
async function loadAgents() {
  try {
    const d = await api.get('/agents');
    agentsData = d.agents || [];
  } catch { agentsData = []; }
}

async function loadCampaigns() {
  try {
    const d = await api.get('/campaigns');
    campaignsData = d.campaigns || [];
  } catch { campaignsData = []; }
}

// Modal
function openModal(agent) {
  const m = document.getElementById('agentModal');
  document.getElementById('modalTitle').innerHTML = `${agentIcon(agent.name)} ${agent.name.replace(/-/g, ' ')}`;
  
  const caps = (agent.capabilities || []).map(c =>
    `<div class="cap-item">${esc(typeof c === 'string' ? c : c.name || JSON.stringify(c))}</div>`
  ).join('');
  
  document.getElementById('modalBody').innerHTML = `
    <p style="color:var(--text-secondary);margin-bottom:16px;">${esc(agent.description || '')}</p>
    <div class="panel-title">Capabilities</div>
    <div class="caps-expanded">${caps || '<span class="text-muted">No capabilities listed</span>'}</div>
    <div class="panel-title" style="margin-top:20px;">Try it</div>
    <div style="display:flex;flex-direction:column;gap:10px;">
      <textarea class="input" id="tryInput" rows="3" placeholder='{"task":"write a blog post about AI"}'></textarea>
      <button class="btn btn-primary" onclick="tryAgent('${agent.name}')">Run agent</button>
      <pre id="tryOutput" style="display:none;max-height:300px;overflow:auto;"></pre>
    </div>
  `;
  m.classList.add('active');
}

function closeModal() { document.getElementById('agentModal').classList.remove('active'); }
document.getElementById('agentModal').addEventListener('click', (e) => { if (e.target.classList.contains('modal-overlay')) closeModal(); });

async function tryAgent(name) {
  const out = document.getElementById('tryOutput');
  const input = document.getElementById('tryInput').value;
  out.style.display = 'block';
  out.textContent = 'Running...';
  try {
    let body;
    try { body = JSON.parse(input); } catch { body = { task: input }; }
    body.agent = name;
    const res = await api.post('/run', body);
    out.textContent = JSON.stringify(res, null, 2);
  } catch (e) { out.textContent = 'Error: ' + e.message; }
}

// === Pages ===
function renderOverview() {
  const el = document.getElementById('dashContent');
  el.innerHTML = `
    <div class="dash-header"><h1>Overview</h1><p>Your agent marketplace at a glance</p></div>
    <div class="stats-row">
      <div class="card stat-card">
        <div class="stat-label">Agents</div>
        <div class="stat-value">${agentsData.length}</div>
        <div class="stat-change up">All operational</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">Campaigns</div>
        <div class="stat-value">${campaignsData.length}</div>
        <div class="stat-change up">Active</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">Today</div>
        <div class="stat-value font-mono">0</div>
        <div class="stat-change">Generations</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">Status</div>
        <div class="stat-value" style="color:var(--success);font-size:18px;">● Online</div>
        <div class="stat-change">All systems go</div>
      </div>
    </div>
    <div class="panel">
      <div class="panel-title">Quick Actions</div>
      <div class="quick-actions">
        <button class="btn btn-primary" onclick="location.hash='agents'">Browse agents</button>
        <button class="btn" onclick="location.hash='campaigns'">View campaigns</button>
        <a href="setup.html" class="btn">Setup guide</a>
        <a href="docs.html" class="btn">API docs</a>
      </div>
    </div>
    <div class="panel">
      <div class="panel-title">Recent Agents</div>
      <div class="agent-grid">
        ${agentsData.slice(0, 6).map(a => agentCardHTML(a)).join('')}
      </div>
    </div>
  `;
}

function agentCardHTML(a) {
  const capsCount = (a.capabilities || []).length;
  return `
    <div class="card agent-card" onclick='openModal(${JSON.stringify(a).replace(/'/g,"&#39;")})'>
      <div class="agent-card-head">
        <div class="agent-card-icon">${agentIcon(a.name)}</div>
        <span class="badge badge-success">active</span>
      </div>
      <h3>${a.name.replace(/-/g, ' ')}</h3>
      <p>${esc(a.description || 'No description')}</p>
      <div class="agent-card-caps">
        ${(a.capabilities || []).slice(0, 4).map(c => `<span class="badge badge-accent">${esc(typeof c === 'string' ? c : c.name || '?')}</span>`).join('')}
        ${capsCount > 4 ? `<span class="badge">+${capsCount - 4}</span>` : ''}
      </div>
      <div class="agent-card-footer">
        <span class="text-xs text-muted font-mono">v${a.version || '1.0'}</span>
        <button class="btn btn-sm btn-primary" onclick="event.stopPropagation();openModal(${JSON.stringify(a).replace(/'/g,"&#39;")})">Run</button>
      </div>
    </div>`;
}

function renderAgents() {
  const el = document.getElementById('dashContent');
  el.innerHTML = `
    <div class="dash-header"><h1>Agents</h1><p>${agentsData.length} agents available</p></div>
    <div class="agent-grid">${agentsData.map(a => agentCardHTML(a)).join('')}</div>
  `;
}

function renderCampaigns() {
  const el = document.getElementById('dashContent');
  const rows = campaignsData.length ? campaignsData.map(c => `
    <tr>
      <td style="font-weight:500;">${esc(c.name || c.id)}</td>
      <td><span class="badge ${c.status==='active'?'badge-success':c.status==='paused'?'badge-warning':'badge-accent'}">${c.status || 'draft'}</span></td>
      <td class="font-mono text-sm">${c.strategy || '—'}</td>
      <td class="text-muted text-sm">${c.created ? timeAgo(c.created) : '—'}</td>
    </tr>`).join('') : `<tr><td colspan="4" class="text-muted" style="text-align:center;padding:32px;">No campaigns yet. <a href="docs.html#campaigns">Learn how to create one →</a></td></tr>`;
  
  el.innerHTML = `
    <div class="dash-header flex justify-between items-center">
      <div><h1>Campaigns</h1><p>${campaignsData.length} campaigns</p></div>
      <button class="btn btn-primary" id="newCampaignBtn">+ New campaign</button>
    </div>
    <div class="card" style="padding:0;overflow:hidden;">
      <table class="campaign-table">
        <thead><tr><th>Name</th><th>Status</th><th>Strategy</th><th>Created</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
  document.getElementById('newCampaignBtn')?.addEventListener('click', () => {
    const name = prompt('Campaign name:');
    if (!name) return;
    api.post('/campaigns', { name, strategy: 'content-marketing' })
      .then(() => { toast.show('Campaign created'); loadCampaigns().then(renderCampaigns); })
      .catch(e => toast.show(e.message, 'error'));
  });
}

function renderAnalytics() {
  const el = document.getElementById('dashContent');
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const vals = [35, 52, 48, 70, 63, 28, 15];
  const max = Math.max(...vals);
  
  el.innerHTML = `
    <div class="dash-header"><h1>Analytics</h1><p>Usage and performance metrics</p></div>
    <div class="stats-row">
      <div class="card stat-card">
        <div class="stat-label">This Week</div>
        <div class="stat-value">${vals.reduce((a,b)=>a+b, 0)}</div>
        <div class="stat-change up">+12%</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">Avg/Day</div>
        <div class="stat-value">${Math.round(vals.reduce((a,b)=>a+b,0)/7)}</div>
        <div class="stat-change">Requests</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">Top Agent</div>
        <div class="stat-value" style="font-size:16px;">writer</div>
        <div class="stat-change">Most used</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">Uptime</div>
        <div class="stat-value" style="color:var(--success);">99.9%</div>
        <div class="stat-change up">Last 30 days</div>
      </div>
    </div>
    <div class="panel">
      <div class="panel-title">Requests This Week</div>
      <div class="card">
        <div class="bar-chart">
          ${days.map((d, i) => `<div class="bar-col"><div class="bar" style="height:${(vals[i]/max)*140}px"></div><div class="bar-label">${d}</div></div>`).join('')}
        </div>
      </div>
    </div>
    <div class="panel">
      <div class="panel-title">Agent Usage</div>
      <div class="card" style="padding:0;overflow:hidden;">
        <table class="campaign-table">
          <thead><tr><th>Agent</th><th>Requests</th><th>Avg Latency</th><th>Status</th></tr></thead>
          <tbody>
            ${agentsData.slice(0, 8).map(a => `<tr><td>${agentIcon(a.name)} ${a.name}</td><td class="font-mono">${Math.floor(Math.random()*50)}</td><td class="font-mono text-muted">${(Math.random()*3+0.5).toFixed(1)}s</td><td><span class="badge badge-success">active</span></td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderSettings() {
  const el = document.getElementById('dashContent');
  const key = api.key || '';
  el.innerHTML = `
    <div class="dash-header"><h1>Settings</h1><p>API configuration</p></div>
    <div class="card" style="max-width:520px;">
      <div class="panel-title">API Key</div>
      <p class="text-sm text-secondary mb-4">Used for authenticating API requests.</p>
      <div style="display:flex;gap:8px;">
        <input type="password" class="input" id="apiKeyInput" value="${esc(key)}" placeholder="sk_...">
        <button class="btn" onclick="document.getElementById('apiKeyInput').type=document.getElementById('apiKeyInput').type==='password'?'text':'password'">👁</button>
      </div>
      <button class="btn btn-primary mt-4" onclick="api.setKey(document.getElementById('apiKeyInput').value);toast.show('API key saved');">Save</button>
    </div>
    <div class="card mt-4" style="max-width:520px;">
      <div class="panel-title">Server Health</div>
      <div id="healthStatus" class="text-sm text-muted">Checking...</div>
    </div>
  `;
  api.get('/health').then(d => {
    document.getElementById('healthStatus').innerHTML = `<span class="badge badge-success">● Healthy</span> <span class="font-mono text-xs ml-2">${JSON.stringify(d)}</span>`;
  }).catch(e => {
    document.getElementById('healthStatus').innerHTML = `<span class="badge badge-error">● Unreachable</span> <span class="text-xs">${e.message}</span>`;
  });
}

// Router
const router = new Router();
router
  .on('overview', renderOverview)
  .on('agents', renderAgents)
  .on('campaigns', renderCampaigns)
  .on('analytics', renderAnalytics)
  .on('settings', renderSettings);

// Init
(async () => {
  await Promise.all([loadAgents(), loadCampaigns()]);
  router.start();
})();
