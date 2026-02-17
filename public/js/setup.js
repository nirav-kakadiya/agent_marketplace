// === Setup Wizard Logic ===
const integrations = [
  { icon: '🔍', name: 'Brave Search', desc: 'Web research', key: 'BRAVE_API_KEY' },
  { icon: '📝', name: 'WordPress', desc: 'Auto-publishing', key: 'WP_URL' },
  { icon: '🐦', name: 'Twitter/X', desc: 'Social posting', key: 'TWITTER_API_KEY' },
  { icon: '📧', name: 'SendGrid', desc: 'Email delivery', key: 'SENDGRID_API_KEY' },
  { icon: '📊', name: 'Google Analytics', desc: 'Traffic data', key: 'GA_ID' },
  { icon: '🪝', name: 'Webhooks', desc: 'Event notifications', key: 'WEBHOOK_URL' },
];

document.getElementById('integrationsGrid').innerHTML = integrations.map(i => `
  <div class="int-card">
    <div class="int-icon">${i.icon}</div>
    <div><h4>${i.name}</h4><p>${i.desc}</p></div>
  </div>
`).join('');

function toggleStep(n) {
  document.querySelectorAll('.step-card').forEach((c, i) => {
    c.classList.toggle('active', i + 1 === n);
  });
}

function saveApiKey() {
  const key = document.getElementById('setupApiKey').value.trim();
  if (!key) { toast.show('Enter an API key', 'error'); return; }
  api.setKey(key);
  document.getElementById('step1').classList.add('completed');
  document.getElementById('step1Status').textContent = '✅ Saved';
  toast.show('API key saved');
  updateProgress();
  toggleStep(2);
}

async function checkSetup() {
  // Check API key
  const key = localStorage.getItem('api_key');
  if (key) {
    document.getElementById('setupApiKey').value = key;
    document.getElementById('step1').classList.add('completed');
    document.getElementById('step1Status').textContent = '✅ Saved';
  }

  // Check server setup
  try {
    const setup = await fetch('/api/v1/setup').then(r => r.json());
    const llm = setup.llm?.configured ?? setup.llmConfigured ?? false;
    document.getElementById('step2Status').textContent = llm ? '✅ Connected' : '❌ Not configured';
    if (llm) document.getElementById('step2').classList.add('completed');
  } catch {
    document.getElementById('step2Status').textContent = '⚠️ Server offline';
  }
  
  updateProgress();
}

function updateProgress() {
  const completed = document.querySelectorAll('.step-card.completed').length;
  document.getElementById('progressFill').style.width = `${(completed / 3) * 100}%`;
}

checkSetup();
