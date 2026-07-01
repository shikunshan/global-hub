// Global Hub - Main Application Logic

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
    state.categories = sitesData.categories;
    state.sites = sitesData.sites;
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
      data-category="${item.id}"
    >
      ${item.label}
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
  const target = document.getElementById('featuredSection');
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
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
          ${subcat.name[state.currentLang]}
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
    ? `<span class="new-badge inline-flex items-center px-2 py-0.5 text-xs font-semibold text-white bg-brand-500 rounded-full ml-2">${t.newLabel}</span>`
    : '';

  return `
    <a
      href="${site.url}"
      target="_blank"
      rel="noopener"
      class="site-card card-stagger block group p-3 -mx-1 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
      style="animation-delay: ${index * 0.04}s"
    >
      <div class="flex items-start gap-3">
        <div class="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-xl group-hover:scale-110 transition-transform overflow-hidden">
          ${renderLogo(site, 'w-6 h-6')}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1">
            <h4 class="font-semibold text-slate-900 dark:text-white text-sm truncate">
              ${site.name}
            </h4>
            ${newBadge}
          </div>
          <p class="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
            ${site.desc[state.currentLang]}
          </p>
        </div>
      </div>
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
    ? `<span class="new-badge inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold text-white bg-brand-500 rounded-full">${t.newLabel}</span>`
    : '';

  const hostname = (() => {
    try { return new URL(site.url).hostname.replace('www.', ''); }
    catch { return site.url; }
  })();

  return `
    <a
      href="${site.url}"
      target="_blank"
      rel="noopener"
      class="site-card card-stagger group bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-xl border border-slate-200/80 dark:border-slate-800/80 p-4 shadow-sm hover:shadow-lg hover:border-brand-300/60 dark:hover:border-brand-500/30"
      style="animation-delay: ${index * 0.03}s"
    >
      <div class="flex items-start gap-3">
        <div class="flex-shrink-0 w-11 h-11 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-xl group-hover:scale-110 transition-transform duration-300 overflow-hidden">
          ${renderLogo(site, 'w-7 h-7')}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <h4 class="font-semibold text-slate-900 dark:text-white text-sm truncate">
              ${site.name}
            </h4>
            ${newBadge}
          </div>
          <p class="text-[11px] text-slate-400 dark:text-slate-500 font-mono mt-0.5 truncate">
            ${hostname}
          </p>
        </div>
      </div>
      <p class="mt-3 text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
        ${site.desc[state.currentLang]}
      </p>
      <div class="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <span class="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
          ${t.lastUpdated} ${formatDate(site.lastUpdated)}
        </span>
        <svg xmlns="http://www.w3.org/2000/svg" class="text-slate-300 dark:text-slate-600 group-hover:text-brand-500 dark:group-hover:text-brand-400 transition-colors" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>
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
// 优先使用已下载到项目本地的 favicon 文件，避免每次请求外部 API，提升加载速度
function renderLogo(site, sizeClass = 'w-6 h-6') {
  const local = `assets/icons/${site.id}.png`;
  const google = getGoogleLogoUrl(site);
  const ddg = getDuckDuckGoLogoUrl(site);
  // 链式 onerror：本地文件加载失败 → Google API → DuckDuckGo API
  return `<img src="${local}" alt="${site.name}" loading="lazy" class="${sizeClass} rounded object-contain" onerror="this.onerror=null;this.src='${google}';this.onerror=function(){this.onerror=null;this.src='${ddg}'}" />`;
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
