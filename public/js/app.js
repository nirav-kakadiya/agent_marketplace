// === Shared API Client & Utilities ===
const API_BASE = '/api/v1';

const api = {
  key: localStorage.getItem('api_key') || '',
  
  setKey(k) { this.key = k; localStorage.setItem('api_key', k); },
  
  async req(method, path, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (this.key) opts.headers['Authorization'] = `Bearer ${this.key}`;
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(API_BASE + path, opts);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || res.statusText);
    }
    return res.json();
  },
  
  get: (p) => api.req('GET', p),
  post: (p, b) => api.req('POST', p, b),
};

// Toast notifications
const toast = {
  container: null,
  init() {
    if (this.container) return;
    this.container = document.createElement('div');
    this.container.className = 'toast-container';
    document.body.appendChild(this.container);
  },
  show(msg, type = 'success') {
    this.init();
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = msg;
    this.container.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 200); }, 3000);
  }
};

// Copy to clipboard
function copyText(text) {
  navigator.clipboard.writeText(text).then(() => toast.show('Copied!')).catch(() => toast.show('Copy failed', 'error'));
}

// Time formatting
function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

// Agent icons (simple emoji mapping)
const AGENT_ICONS = {
  orchestrator: '🎯', researcher: '🔍', writer: '✍️', editor: '📝',
  publisher: '📤', 'social-writer': '💬', 'brand-manager': '🎨',
  scheduler: '📅', analytics: '📊', 'campaign-manager': '📋',
  'content-repurposer': '♻️', 'data-analyst': '📈', devops: '⚙️',
  ecommerce: '🛒', 'email-marketing': '📧', seo: '🔎',
  'social-media-manager': '📱', 'brand-design': '🖌️', sales: '💼'
};

function agentIcon(name) { return AGENT_ICONS[name] || '🤖'; }

// Simple hash router
class Router {
  constructor() { this.routes = {}; this.current = null; }
  on(hash, fn) { this.routes[hash] = fn; return this; }
  start() {
    const go = () => {
      const h = (location.hash || '#overview').slice(1);
      const route = this.routes[h];
      if (route) { this.current = h; route(); }
      document.querySelectorAll('[data-route]').forEach(el => {
        el.classList.toggle('active', el.dataset.route === h);
      });
    };
    window.addEventListener('hashchange', go);
    go();
  }
}

// Escape HTML
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
