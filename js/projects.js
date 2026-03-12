(function () {
  const LANG_COLORS = {
    JavaScript: '#f1e05a',
    TypeScript: '#3178c6',
    Python: '#3572A5',
    Java: '#b07219',
    'C++': '#f34b7d',
    C: '#555555',
    'C#': '#178600',
    Go: '#00ADD8',
    Rust: '#dea584',
    Shell: '#89e051',
    HTML: '#e34c26',
    CSS: '#563d7c',
    Vue: '#41b883',
    Ruby: '#701516',
    PHP: '#4F5D95',
    Kotlin: '#A97BFF',
    Swift: '#F05138',
    Scala: '#c22d40',
    Jupyter_Notebook: '#DA5B0B'
  };

  const CATEGORY_RULES = {
    'AI & LLM': ['worldmonitor', 'TradingAgents-CN', 'hello-agents', 'ai-engineering-hub', 'FinRobot', 'deepwiki-open', 'LLMs-from-scratch', 'self-llm', 'ai-hedge-fund', 'Awesome-Chinese-LLM', 'EssayKiller_V2', 'generative-ai-for-beginners', 'MoneyPrinterTurbo', 'chatgpt-on-wechat', 'WeClone', 'DeepFaceLab', 'Real-Time-Voice-Cloning', 'DiffSynth-Studio', 'pykan', 'VideoLingo', 'shannon', 'deepwiki_markdown', 'AISystem', 'mcp-for-beginners', 'GitNexus'],
    'Quant Finance': ['nautilus_trader', 'stock2', 'stock', 'gs-quant', 'easyquotation', 'wondertrader', 'hikyuu', 'easytrader', 'vnpy', 'freqtrade', 'iMaoTai-reserve'],
    Tools: ['Pake', 'automa', 'EasySpider', 'Stirling-PDF', 'mediago', 'TikTokDownloader', 'douyin-downloader', 'MediaCrawler', 'MediaCrawler-new', '1Panel', 'scrcpy', 'JetBrainsActiveCode', 'Microsoft-Activation-Scripts', 'miaosha', 'PyWxDump', 'hackingtool', 'unlimited-landeng-for-win', 'Spark-his-Docker', 'siyuan', 'legado'],
    Learning: ['everyone-can-use-english', 'leetcode', 'LeetCodeAnimation', '90DaysOfCyberSecurity', 'awesome-software-architecture', 'GPU-Puzzles', 'system-design-resources', 'awesome-python-login-model', 'awesome', 'Python', 'awesome-english-ebooks', 'GitHub-Chinese-Top-Charts', 'funNLP', 'Anime4K', 'BigDL', 'scikit-learn-intelex', 'excelCPU', 'gpgpu-sim_distribution']
  };

  const CATEGORY_ORDER = ['AI & LLM', 'Quant Finance', 'Tools', 'Learning', 'Other'];
  const REPO_CATEGORY = {};
  let allRepos = [];
  let activeLang = '';
  let activeCategory = '';

  Object.entries(CATEGORY_RULES).forEach(([category, repoNames]) => {
    repoNames.forEach(repoName => {
      REPO_CATEGORY[repoName] = category;
    });
  });

  const langColor = language => LANG_COLORS[language?.replaceAll(' ', '_')] || '#ccc';

  function timeAgo(dateString) {
    const seconds = Math.floor((Date.now() - new Date(dateString)) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
    if (seconds < 2592000) return Math.floor(seconds / 86400) + 'd ago';
    if (seconds < 31536000) return Math.floor(seconds / 2592000) + 'mo ago';
    return Math.floor(seconds / 31536000) + 'y ago';
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  const getCategory = repoName => REPO_CATEGORY[repoName] || 'Other';

  function renderStats(repos, updated) {
    const languages = Array.from(new Set(repos.map(repo => repo.language).filter(Boolean)));
    const stars = repos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
    const forks = repos.reduce((sum, repo) => sum + repo.forks_count, 0);
    const updatedHtml = updated ? '<span class="pj-updated">Updated ' + timeAgo(updated) + '</span>' : '';

    document.getElementById('pj-stats').innerHTML = '' +
      '<div class="pj-stat"><span class="num">' + repos.length + '</span><span class="lbl">Repositories</span></div>' +
      '<div class="pj-stat"><span class="num">' + stars + '</span><span class="lbl">Total Stars</span></div>' +
      '<div class="pj-stat"><span class="num">' + forks + '</span><span class="lbl">Total Forks</span></div>' +
      '<div class="pj-stat"><span class="num">' + languages.length + '</span><span class="lbl">Languages</span></div>' +
      updatedHtml;
  }

  function renderCategoryFilters(repos) {
    const categories = Array.from(new Set(repos.map(repo => getCategory(repo.name)))).sort((left, right) => left.localeCompare(right));
    let html = '<button class="cat-btn active" data-category="">All Categories</button>';
    html += categories.map(category => '<button class="cat-btn" data-category="' + escapeHtml(category) + '">' + escapeHtml(category) + '</button>').join('');
    document.getElementById('cat-filters').innerHTML = html;
  }

  function renderLanguageFilters(repos) {
    const counts = {};
    repos.forEach(repo => {
      if (repo.language) counts[repo.language] = (counts[repo.language] || 0) + 1;
    });

    const sorted = Object.entries(counts).sort((left, right) => right[1] - left[1]).slice(0, 8);
    let html = '<button class="lang-btn active" data-lang="">All</button>';
    html += sorted.map(([language, count]) => '<button class="lang-btn" data-lang="' + escapeHtml(language) + '" style="border-color:' + langColor(language) + '">' + escapeHtml(language) + ' <span class="lang-count">' + count + '</span></button>').join('');
    document.getElementById('lang-filters').innerHTML = html;
  }

  function repoCard(repo) {
    const description = repo.description ? escapeHtml(repo.description) : '<em class="pj-empty-desc">No description</em>';
    const language = repo.language
      ? '<span class="pj-lang"><span class="lang-dot" style="background:' + langColor(repo.language) + '"></span>' + escapeHtml(repo.language) + '</span>'
      : '';

    return '' +
      '<div class="pj-card">' +
        '<a class="pj-card-name" href="' + repo.html_url + '" target="_blank" rel="noopener">' +
          '<i class="fas fa-' + (repo.fork ? 'code-branch' : 'book') + ' pj-card-icon"></i>' + escapeHtml(repo.name) +
          (repo.fork ? '<span class="pj-fork-badge">fork</span>' : '') +
          (repo.archived ? '<span class="pj-archived">archived</span>' : '') +
        '</a>' +
        '<p class="pj-card-desc">' + description + '</p>' +
        '<div class="pj-card-meta">' +
          language +
          '<span class="pj-card-stars"><i class="fas fa-star pj-star-icon"></i>' + repo.stargazers_count + '</span>' +
          '<span class="pj-card-forks"><i class="fas fa-code-branch pj-fork-icon"></i>' + repo.forks_count + '</span>' +
          '<span class="pj-card-updated">' + timeAgo(repo.pushed_at) + '</span>' +
        '</div>' +
      '</div>';
  }

  function renderRepos(repos) {
    const grid = document.getElementById('pj-grid');
    const empty = document.getElementById('pj-empty');

    if (!repos.length) {
      grid.innerHTML = '';
      empty.style.display = 'block';
      return;
    }

    empty.style.display = 'none';

    if (!activeCategory) {
      const groups = {};
      repos.forEach(repo => {
        const category = getCategory(repo.name);
        if (!groups[category]) groups[category] = [];
        groups[category].push(repo);
      });

      const sortedCategories = CATEGORY_ORDER.filter(category => groups[category]).concat(
        Object.keys(groups).filter(category => !CATEGORY_ORDER.includes(category))
      );

      grid.innerHTML = sortedCategories.map(category => (
        '<div class="pj-section-header">' + escapeHtml(category) + ' <span class="pj-section-count">(' + groups[category].length + ')</span></div>' +
        '<div class="pj-grid">' + groups[category].map(repoCard).join('') + '</div>'
      )).join('');
      return;
    }

    grid.innerHTML = '<div class="pj-grid">' + repos.map(repoCard).join('') + '</div>';
  }

  function filterRepos() {
    const query = document.getElementById('pj-search').value.toLowerCase();
    const filtered = allRepos.filter(repo => {
      const matchCategory = !activeCategory || getCategory(repo.name) === activeCategory;
      const matchLang = !activeLang || repo.language === activeLang;
      const description = (repo.description || '').toLowerCase();
      const matchQuery = !query || repo.name.toLowerCase().includes(query) || description.includes(query);
      return matchCategory && matchLang && matchQuery;
    });
    renderRepos(filtered);
  }

  function bindEvents() {
    document.getElementById('pj-search').addEventListener('input', filterRepos);

    document.getElementById('lang-filters').addEventListener('click', event => {
      const button = event.target.closest('.lang-btn');
      if (!button) return;
      activeLang = button.dataset.lang || '';
      document.querySelectorAll('.lang-btn').forEach(item => {
        item.classList.toggle('active', item === button);
      });
      filterRepos();
    });

    document.getElementById('cat-filters').addEventListener('click', event => {
      const button = event.target.closest('.cat-btn');
      if (!button) return;
      activeCategory = button.dataset.category || '';
      document.querySelectorAll('.cat-btn').forEach(item => {
        item.classList.toggle('active', item === button);
      });
      filterRepos();
    });
  }

  function initPangu() {
    if (typeof panguFn !== 'function') return;
    if (GLOBAL_CONFIG_SITE.isPost) panguFn();
  }

  async function loadRepos() {
    try {
      const response = await fetch('/projects/data/repos.json');
      if (!response.ok) throw new Error(response.status);
      const data = await response.json();
      allRepos = data.repos;
      renderStats(data.repos, data.updated);
      renderCategoryFilters(data.repos);
      renderLanguageFilters(data.repos);
      renderRepos(data.repos);
    } catch (error) {
      console.error('Failed to load project data.', error);
      document.getElementById('pj-grid').innerHTML = '<div class="pj-loading pj-loading-error"><i class="fas fa-exclamation-triangle"></i>&nbsp;Failed to load repository data.</div>';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    loadRepos();
    initPangu();
  });
})();
