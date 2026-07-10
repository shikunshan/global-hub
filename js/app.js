// Global Hub - Main Application Logic

// --- HTML / URL escaping helpers (defense-in-depth for data-driven markup) ---

// 转义用于 HTML 文本节点的内容
function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 转义用于 HTML 属性值的内容（与文本转义相同，额外覆盖引号）
function escapeAttr(value) {
  return escapeHtml(value);
}

// 仅允许 http/https 链接，阻断 javascript:、data: 等危险协议
function sanitizeUrl(url) {
  const raw = String(url == null ? '' : url).trim();
  try {
    const parsed = new URL(raw, window.location.href);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
  } catch {
    /* 无法解析则视为不安全 */
  }
  return '#';
}

const state = {
  sites: [],
  categories: [],
  i18n: { en: {}, zh: {} },
  currentLang: 'en',
  currentTheme: 'light',
  activeCategory: 'all',
  searchQuery: '',
};

// Bang syntax shortcuts
const BANG_COMMANDS = {
  '!g': 'https://www.google.com/search?q=',
  '!google': 'https://www.google.com/search?q=',
  '!gh': 'https://github.com/search?q=',
  '!github': 'https://github.com/search?q=',
  '!ddg': 'https://duckduckgo.com/?q=',
  '!yt': 'https://www.youtube.com/results?search_query=',
  '!youtube': 'https://www.youtube.com/results?search_query=',
  '!wiki': 'https://en.wikipedia.org/wiki/Special:Search?search=',
  '!wikipedia': 'https://en.wikipedia.org/wiki/Special:Search?search=',
  '!so': 'https://stackoverflow.com/search?q=',
  '!stackoverflow': 'https://stackoverflow.com/search?q=',
  '!hn': 'https://hn.algolia.com/?q=',
  '!hackernews': 'https://hn.algolia.com/?q=',
  '!tw': 'https://twitter.com/search?q=',
  '!twitter': 'https://twitter.com/search?q=',
  '!r': 'https://www.reddit.com/search/?q=',
  '!reddit': 'https://www.reddit.com/search/?q=',
  '!npm': 'https://www.npmjs.com/search?q=',
  '!hf': 'https://huggingface.co/search?q=',
  '!arxiv': 'https://arxiv.org/search/?query=',
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  setupLogoFallback();
  await loadData();
  initLanguage();
  renderCategories();
  renderFeaturedSection();
  renderRegularCategories();
  setupSearch();
  setupEventListeners();
});

// --- Data Loading ---
async function loadData() {
  try {
    const [sitesRes, i18nRes] = await Promise.all([
      fetch('data/sites.json'),
      fetch('data/i18n.json'),
    ]);
    const sitesData = await sitesRes.json();
    const i18nData = await i18nRes.json();
    // 应用默认值，允许 sites.json 省略公共字段（缩小体积）
    const defaults = sitesData.defaults || {};
    const defaultDate = defaults.lastUpdated || '2024-07-01';
    state.categories = sitesData.categories;
    state.sites = sitesData.sites.map((site) => ({
      subcategory: null,
      isNew: false,
      lastUpdated: defaultDate,
      ...site,
    }));
    state.i18n = i18nData;
  } catch (err) {
    console.error('Failed to load data:', err);
  }
}

// --- Theme Management ---
function initTheme() {
  const saved = localStorage.getItem('gh-theme');
  if (saved) {
    state.currentTheme = saved;
  } else {
    state.currentTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  applyTheme();
}

function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.currentTheme);
  if (state.currentTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  localStorage.setItem('gh-theme', state.currentTheme);
}

function toggleTheme() {
  state.currentTheme = state.currentTheme === 'dark' ? 'light' : 'dark';
  applyTheme();
}

// --- Language Management ---
function initLanguage() {
  const saved = localStorage.getItem('gh-lang');
  if (saved) {
    state.currentLang = saved;
  } else {
    const browserLang = navigator.language.toLowerCase();
    state.currentLang = browserLang.startsWith('zh') ? 'zh' : 'en';
  }
  applyLanguage();
}

function applyLanguage() {
  const t = state.i18n[state.currentLang];
  if (!t) return;

  document.documentElement.lang = state.currentLang === 'zh' ? 'zh-CN' : 'en';

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key]) el.textContent = t[key];
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (t[key]) el.placeholder = t[key];
  });

  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc && t.metaDescription) metaDesc.content = t.metaDescription;

  const langLabel = document.querySelector('[data-i18n-key="langLabel"]');
  if (langLabel) langLabel.textContent = state.currentLang === 'zh' ? '中' : 'EN';

  document.title = `Global Hub - ${t.heroTitle}`;
}

function toggleLanguage() {
  state.currentLang = state.currentLang === 'en' ? 'zh' : 'en';
  localStorage.setItem('gh-lang', state.currentLang);
  applyLanguage();
  renderCategories();
  renderFeaturedSection();
  renderRegularCategories();
}

// --- Category Navigation ---
function renderCategories() {
  const nav = document.querySelector('#categoryNav > div > div');
  if (!nav) return;
  const t = state.i18n[state.currentLang];

  const navItems = [
    { id: 'all', label: t.navAll || 'All' },
    ...state.categories.map(cat => ({
      id: cat.id,
      label: cat.name[state.currentLang],
    })),
  ];

  nav.innerHTML = navItems.map(item => `
    <button
      class="cat-btn px-4 py-2 text-sm font-medium rounded-lg transition-colors
        ${state.activeCategory === item.id
          ? 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10 active'
          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'}"
      data-category="${escapeAttr(item.id)}"
    >
      ${escapeHtml(item.label)}
    </button>
  `).join('');

  nav.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeCategory = btn.dataset.category;
      state.searchQuery = '';
      document.getElementById('searchInput').value = '';
      renderCategories();
      filterAndRender();
      scrollToContent();
    });
  });
}

function scrollToContent() {
  // 找到当前实际可见的第一个内容区块（精选区在切到普通分类时会隐藏）
  const featured = document.getElementById('featuredSection');
  const container = document.getElementById('categoriesContainer');
  let target = null;
  if (featured && !featured.classList.contains('hidden')) {
    target = featured;
  } else if (container && container.firstElementChild) {
    target = container.firstElementChild; // 第一个分类 section
  }
  if (!target) return;

  // 顶部有 sticky header + sticky 分类导航，需要减去它们的高度，
  // 否则第一行卡片会被遮住。留一点额外呼吸空间。
  const header = document.querySelector('header');
  const nav = document.getElementById('categoryNav');
  const offset =
    (header ? header.offsetHeight : 64) +
    (nav ? nav.offsetHeight : 56) +
    16;

  const top =
    target.getBoundingClientRect().top + window.pageYOffset - offset;
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
}

// --- Featured Section (AI Frontier) ---
function renderFeaturedSection() {
  const featuredCat = state.categories.find(c => c.featured);
  const featuredGrid = document.getElementById('featuredGrid');
  const featuredSection = document.getElementById('featuredSection');
  if (!featuredCat || !featuredGrid) return;
  const t = state.i18n[state.currentLang];

  const filteredSites = getFilteredSites();
  const featuredSites = filteredSites.filter(s => s.category === featuredCat.id);

  if (state.searchQuery || (state.activeCategory !== 'all' && state.activeCategory !== featuredCat.id)) {
    featuredSection.classList.add('hidden');
    return;
  }
  featuredSection.classList.remove('hidden');

  const subcats = featuredCat.subcategories || [];
  featuredGrid.innerHTML = subcats.map((subcat, idx) => {
    const subcatSites = featuredSites.filter(s => s.subcategory === subcat.id);
    return `
      <div class="featured-subcategory bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-5 shadow-sm hover:shadow-md transition-shadow" style="animation-delay: ${idx * 0.05}s">
        <h3 class="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
          ${escapeHtml(subcat.name[state.currentLang])}
        </h3>
        <div class="space-y-2">
          ${subcatSites.map((site, sIdx) => createFeaturedCard(site, idx * 10 + sIdx)).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function createFeaturedCard(site, index = 0) {
  const t = state.i18n[state.currentLang];
  const newBadge = site.isNew
    ? `<span class="new-badge inline-flex items-center px-2 py-0.5 text-xs font-semibold text-white bg-brand-500 rounded-full ml-2">${escapeHtml(t.newLabel)}</span>`
    : '';

  return `
    <a
      href="${escapeAttr(sanitizeUrl(site.url))}"
      target="_blank"
      rel="noopener"
      class="featured-card card-stagger relative flex items-start gap-3 group p-3 -mx-1 rounded-xl hover:bg-white dark:hover:bg-slate-800/70 transition-colors"
      style="animation-delay: ${index * 0.04}s"
    >
      <div class="card-logo flex-shrink-0 w-10 h-10 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden ring-1 ring-inset ring-slate-200/60 dark:ring-slate-700/60 group-hover:ring-brand-400/50">
        ${renderLogo(site, 'w-6 h-6')}
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-1">
          <h4 class="font-semibold text-slate-900 dark:text-white text-sm truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
            ${escapeHtml(site.name)}
          </h4>
          ${newBadge}
        </div>
        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
          ${escapeHtml(site.desc[state.currentLang])}
        </p>
      </div>
      <svg xmlns="http://www.w3.org/2000/svg" class="featured-card-arrow self-center flex-shrink-0 text-brand-500 dark:text-brand-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
    </a>
  `;
}

// --- Regular Categories ---
function renderRegularCategories() {
  const container = document.getElementById('categoriesContainer');
  if (!container) return;
  const t = state.i18n[state.currentLang];

  const filteredSites = getFilteredSites();
  const regularCats = state.categories.filter(c => !c.featured);

  let html = '';
  let staggerIndex = 0;

  regularCats.forEach(cat => {
    const catSites = filteredSites.filter(s => s.category === cat.id);
    if (catSites.length === 0) return;

    if (state.activeCategory !== 'all' && state.activeCategory !== cat.id) return;

    html += `
      <section class="mb-14">
        <div class="flex items-center justify-between mb-5">
          <h2 class="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            ${cat.name[state.currentLang]}
          </h2>
          <span class="text-xs text-slate-400 dark:text-slate-500 font-mono">
            ${catSites.length}
          </span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          ${catSites.map(site => {
            const card = createRegularCard(site, staggerIndex);
            staggerIndex++;
            return card;
          }).join('')}
        </div>
      </section>
    `;
  });

  container.innerHTML = html;

  const noResults = document.getElementById('noResults');
  const totalVisible = filteredSites.length;
  if (state.searchQuery && totalVisible === 0) {
    noResults.classList.remove('hidden');
  } else {
    noResults.classList.add('hidden');
  }
}

function createRegularCard(site, index = 0) {
  const t = state.i18n[state.currentLang];
  const newBadge = site.isNew
    ? `<span class="new-badge inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold text-white bg-brand-500 rounded-full">${escapeHtml(t.newLabel)}</span>`
    : '';

  const hostname = (() => {
    try { return new URL(site.url).hostname.replace('www.', ''); }
    catch { return site.url; }
  })();

  const visitLabel = escapeHtml(t.visit || 'Visit');

  return `
    <a
      href="${escapeAttr(sanitizeUrl(site.url))}"
      target="_blank"
      rel="noopener"
      class="site-card card-stagger group relative flex flex-col bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-2xl border border-slate-200/70 dark:border-slate-800/70 p-4 shadow-sm hover:border-transparent overflow-hidden"
      style="animation-delay: ${index * 0.03}s"
    >
      <span class="card-glow" aria-hidden="true"></span>
      <span class="card-sheen" aria-hidden="true"></span>
      <div class="relative flex items-start gap-3">
        <div class="card-logo flex-shrink-0 w-11 h-11 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden ring-1 ring-inset ring-slate-200/60 dark:ring-slate-700/60 group-hover:ring-brand-400/50">
          ${renderLogo(site, 'w-7 h-7')}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <h4 class="font-semibold text-slate-900 dark:text-white text-sm truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
              ${escapeHtml(site.name)}
            </h4>
            ${newBadge}
          </div>
          <p class="text-[11px] text-slate-400 dark:text-slate-500 font-mono mt-0.5 truncate">
            ${escapeHtml(hostname)}
          </p>
        </div>
      </div>
      <p class="relative mt-3 text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
        ${escapeHtml(site.desc[state.currentLang])}
      </p>
      <div class="relative mt-auto pt-3 flex items-center">
        <span class="card-cta inline-flex items-center gap-1 text-xs font-semibold text-brand-600 dark:text-brand-400">
          ${visitLabel}
          <svg xmlns="http://www.w3.org/2000/svg" class="card-cta-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </span>
      </div>
    </a>
  `;
}

// --- Search & Filtering ---
function getFilteredSites() {
  let results = [...state.sites];

  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    results = results.filter(site =>
      site.name.toLowerCase().includes(q) ||
      site.desc.en.toLowerCase().includes(q) ||
      site.desc.zh.toLowerCase().includes(q) ||
      site.category.toLowerCase().includes(q)
    );
  }

  if (state.activeCategory !== 'all') {
    results = results.filter(site => site.category === state.activeCategory);
  }

  return results;
}

function filterAndRender() {
  renderFeaturedSection();
  renderRegularCategories();
}

function setupSearch() {
  const input = document.getElementById('searchInput');
  if (!input) return;

  // 解析 bang 语法，支持「!g 关键词」和「!g关键词」两种写法
  function parseBang(value) {
    if (!value.startsWith('!')) return null;
    // 先尝试带空格的形式：!g keyword
    const spaceParts = value.split(/\s+/);
    const bangSpace = spaceParts[0].toLowerCase();
    if (BANG_COMMANDS[bangSpace]) {
      return { bang: bangSpace, query: spaceParts.slice(1).join(' ').trim() };
    }
    // 再尝试不带空格的形式：!gkeyword（从最长 bang 开始匹配）
    const bangKeys = Object.keys(BANG_COMMANDS).sort((a, b) => b.length - a.length);
    const lower = value.toLowerCase();
    for (const bang of bangKeys) {
      if (lower.startsWith(bang)) {
        const query = value.slice(bang.length).trim();
        return { bang, query };
      }
    }
    return null;
  }

  let debounceTimer;
  input.addEventListener('input', (e) => {
    const value = e.target.value.trim();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      state.searchQuery = value;
      filterAndRender();
    }, 100);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const value = e.target.value.trim();
      const parsed = parseBang(value);
      if (parsed) {
        e.preventDefault();
        window.open(BANG_COMMANDS[parsed.bang] + encodeURIComponent(parsed.query || ''), '_blank');
      }
    }
  });
}

// --- Event Listeners ---
function setupEventListeners() {
  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  const langBtn = document.getElementById('langToggle');
  if (langBtn) langBtn.addEventListener('click', toggleLanguage);

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      document.getElementById('searchInput')?.focus();
    }
    if (e.key === 'Escape') {
      document.getElementById('searchInput')?.blur();
    }
  });
}

// --- Logo Utilities ---

// 从网站 URL 提取主机名（去除 www. 前缀）
function getHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// 生成 Google Favicon API URL（高分辨率）
function getGoogleLogoUrl(site) {
  const hostname = getHostname(site.url);
  return `https://www.google.com/s2/favicons?sz=64&domain=${hostname}`;
}

// 生成 DuckDuckGo 图标服务 URL
function getDuckDuckGoLogoUrl(site) {
  const hostname = getHostname(site.url);
  return `https://icons.duckduckgo.com/ip3/${hostname}.ico`;
}

// 生成 logo 的 HTML（三级 fallback：本地缓存 → Google API → DuckDuckGo API）
// 优先使用已下载到项目本地的 favicon 文件，避免每次请求外部 API，提升加载速度。
// fallback 链通过 data-* 属性 + 事件委托实现（不用内联 onerror，兼容 CSP，避免 XSS）。
function renderLogo(site, sizeClass = 'w-6 h-6') {
  const local = `assets/icons/${encodeURIComponent(site.id)}.png`;
  const google = getGoogleLogoUrl(site);
  const ddg = getDuckDuckGoLogoUrl(site);
  const fallbacks = [google, ddg].join('|');
  return `<img src="${escapeAttr(local)}" alt="${escapeAttr(site.name)}" loading="lazy" decoding="async" class="${escapeAttr(sizeClass)} rounded object-contain" data-logo-fallback="${escapeAttr(fallbacks)}" />`;
}

// 事件委托：图片加载失败时依次尝试 data-logo-fallback 中的备用地址
function setupLogoFallback() {
  document.addEventListener(
    'error',
    (e) => {
      const img = e.target;
      if (!(img instanceof HTMLImageElement)) return;
      const chain = img.getAttribute('data-logo-fallback');
      if (!chain) return;
      const remaining = chain.split('|').filter(Boolean);
      if (remaining.length === 0) {
        img.removeAttribute('data-logo-fallback');
        img.style.visibility = 'hidden'; // 全部失败则隐藏，避免破图
        return;
      }
      const next = remaining.shift();
      img.setAttribute('data-logo-fallback', remaining.join('|'));
      img.src = next;
    },
    true // 捕获阶段：img 的 error 事件不冒泡
  );
}

// --- Utilities ---
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return '1d ago';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}
