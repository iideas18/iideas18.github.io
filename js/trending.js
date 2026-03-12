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
    Swift: '#F05138'
  };

  let currentData = [];
  let activeLang = '';
  let currentPeriod = 'daily';

  const langColor = language => LANG_COLORS[language] || '#ccc';

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function sessionGet(key) {
    try {
      const value = sessionStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Failed to read trending cache.', error);
      return null;
    }
  }

  function sessionSet(key, value) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Failed to write trending cache.', error);
    }
  }

  function renderLanguageFilters(repos) {
    const counts = {};
    repos.forEach(repo => {
      if (repo.language) counts[repo.language] = (counts[repo.language] || 0) + 1;
    });

    const sorted = Object.entries(counts).sort((left, right) => right[1] - left[1]).slice(0, 10);
    let html = '<button class="tr-lang-btn active" data-lang="">All</button>';
    html += sorted.map(([language]) => '<button class="tr-lang-btn" data-lang="' + escapeHtml(language) + '">' + escapeHtml(language) + '</button>').join('');
    document.getElementById('tr-lang-filter').innerHTML = html;
  }

  function renderList(repos) {
    const filtered = activeLang ? repos.filter(repo => repo.language === activeLang) : repos;
    if (!filtered.length) {
      document.getElementById('tr-list').innerHTML = '<div class="tr-empty">No repos for this filter.</div>';
      return;
    }

    document.getElementById('tr-list').innerHTML = filtered.map((repo, index) => {
      const description = repo.description ? escapeHtml(repo.description) : '<em class="tr-empty-desc">No description</em>';
      const language = repo.language
        ? '<span class="tr-lang"><span class="lang-dot" style="background:' + langColor(repo.language) + '"></span>' + escapeHtml(repo.language) + '</span>'
        : '';
      const gained = repo.stars_today || repo.gained;

      return '' +
        '<div class="tr-card">' +
          '<div class="tr-rank ' + (index < 3 ? 'top3' : '') + '">' + (index + 1) + '</div>' +
          '<div class="tr-body">' +
            '<p class="tr-name"><a href="' + repo.url + '" target="_blank" rel="noopener">' + escapeHtml(repo.author) + ' / <strong>' + escapeHtml(repo.name) + '</strong></a></p>' +
            '<p class="tr-desc">' + description + '</p>' +
            '<div class="tr-meta">' +
              language +
              '<span class="tr-stars"><i class="fas fa-star tr-icon-small"></i>' + Number(repo.stars || 0).toLocaleString() + '</span>' +
              '<span class="tr-forks"><i class="fas fa-code-branch tr-icon-small tr-icon-muted"></i>' + Number(repo.forks || 0).toLocaleString() + '</span>' +
              (gained ? '<span class="tr-gained"><i class="fas fa-arrow-up tr-icon-tiny"></i> ' + gained + ' today</span>' : '') +
            '</div>' +
          '</div>' +
        '</div>';
    }).join('');
  }

  async function loadDate(date) {
    if (!date) return;

    document.getElementById('tr-date-select').value = date;
    const cacheKey = 'tr_data_' + date + '_' + currentPeriod;
    const cached = sessionGet(cacheKey);
    if (cached) {
      currentData = cached.repos;
      renderLanguageFilters(cached.repos);
      renderList(cached.repos);
      return;
    }

    document.getElementById('tr-list').innerHTML = '<div class="tr-loading"><i class="fas fa-spinner fa-spin"></i>&nbsp;Loading…</div>';

    try {
      const response = await fetch('/trending/data/' + date + '-' + currentPeriod + '.json');
      if (!response.ok) throw new Error('missing');
      const data = await response.json();
      sessionSet(cacheKey, data);
      currentData = data.repos;
      renderLanguageFilters(data.repos);
      renderList(data.repos);
    } catch (error) {
      console.error('Failed to load trending snapshot.', error);
      document.getElementById('tr-list').innerHTML = '<div class="tr-empty">No ' + currentPeriod + ' snapshot for ' + date + '.</div>';
    }
  }

  async function initTrending() {
    try {
      let index = sessionGet('tr_index');
      if (!index) {
        const response = await fetch('/trending/data/index.json');
        if (!response.ok) throw new Error('no index');
        index = await response.json();
        sessionSet('tr_index', index);
      }

      index.dates.sort((left, right) => right.localeCompare(left));
      const select = document.getElementById('tr-date-select');
      index.dates.forEach(date => {
        const option = document.createElement('option');
        option.value = date;
        option.textContent = date;
        select.appendChild(option);
      });
      document.getElementById('tr-record-count').textContent = index.dates.length;
      if (index.dates.length) loadDate(index.dates[0]);
    } catch (error) {
      console.error('Failed to initialize trending page.', error);
      document.getElementById('tr-list').innerHTML = '<div class="tr-empty">No snapshots yet — the daily job will run at 08:00 CST and populate data here.</div>';
      document.getElementById('tr-record-count').textContent = '0';
    }
  }

  function bindEvents() {
    document.getElementById('tr-date-select').addEventListener('change', event => {
      loadDate(event.target.value);
    });

    document.getElementById('tr-period-btns').addEventListener('click', event => {
      const button = event.target.closest('.tr-period-btn');
      if (!button) return;
      currentPeriod = button.dataset.period;
      document.querySelectorAll('.tr-period-btn').forEach(item => {
        item.classList.toggle('active', item === button);
      });
      loadDate(document.getElementById('tr-date-select').value);
    });

    document.getElementById('tr-lang-filter').addEventListener('click', event => {
      const button = event.target.closest('.tr-lang-btn');
      if (!button) return;
      activeLang = button.dataset.lang || '';
      document.querySelectorAll('.tr-lang-btn').forEach(item => {
        item.classList.toggle('active', item === button);
      });
      renderList(currentData);
    });
  }

  function initPangu() {
    if (typeof panguFn !== 'function') return;
    if (GLOBAL_CONFIG_SITE.isPost) panguFn();
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    initTrending();
    initPangu();
  });
})();
