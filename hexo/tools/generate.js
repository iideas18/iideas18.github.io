'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Hexo = require('hexo');

const EXCLUDED_SOURCE_NAMES = new Set(['.vscode', '_posts']);
const SYNC_ROOT_EXCLUDES = [
  '.git/',
  '.github/',
  'hexo/',
  'node_modules/',
  'README.md',
  '.gitignore',
  '.impulse',
  'scripts/'
];

function copyRecursive(sourcePath, targetPath) {
  const stat = fs.statSync(sourcePath);

  if (stat.isDirectory()) {
    fs.mkdirSync(targetPath, { recursive: true });
    for (const entry of fs.readdirSync(sourcePath)) {
      if (EXCLUDED_SOURCE_NAMES.has(entry)) continue;
      copyRecursive(path.join(sourcePath, entry), path.join(targetPath, entry));
    }
    return;
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
}

function copySourceIntoPublic(hexoRoot) {
  const sourceDir = path.join(hexoRoot, 'source');
  const publicDir = path.join(hexoRoot, 'public');

  for (const entry of fs.readdirSync(sourceDir)) {
    if (EXCLUDED_SOURCE_NAMES.has(entry)) continue;
    copyRecursive(path.join(sourceDir, entry), path.join(publicDir, entry));
  }
}

function buildPartials(hexo, publicDir) {
  const posts      = hexo.locals.get('posts').toArray().sort((a, b) => b.date - a.date);
  const categories = hexo.locals.get('categories').toArray().sort((a, b) => b.posts.length - a.posts.length);
  const tags       = hexo.locals.get('tags').toArray().sort((a, b) => b.posts.length - a.posts.length);

  const postCount = posts.length;
  const tagCount  = tags.length;
  const catCount  = categories.length;

  // Total word count (rough: strip HTML tags, count CJK chars + space-separated words)
  let totalChars = 0;
  for (const p of posts) {
    const text = (p.content || '').replace(/<[^>]+>/g, '');
    totalChars += text.length;
  }
  const wordStr = totalChars >= 10000
    ? (totalChars / 10000).toFixed(1) + 'w'
    : (totalChars / 1000).toFixed(1) + 'k';

  // Newest post date for "最后更新时间"
  const lastPushDate = posts.length ? posts[0].date.toISOString() : new Date().toISOString();

  const nav = `<div class="menus_items">`
    + `<div class="menus_item"><a class="site-page" href="/"><i class="fa-fw fas fa-home"></i><span> Home</span></a></div>`
    + `<div class="menus_item"><a class="site-page" href="/archives/"><i class="fa-fw fas fa-archive"></i><span> Archives</span></a></div>`
    + `<div class="menus_item"><a class="site-page" href="/tags/"><i class="fa-fw fas fa-tags"></i><span> Tags</span></a></div>`
    + `<div class="menus_item"><a class="site-page" href="/categories/"><i class="fa-fw fas fa-folder-open"></i><span> Categories</span></a></div>`
    + `<div class="menus_item"><a class="site-page" href="/about/"><i class="fa-fw fas fa-heart"></i><span> About</span></a></div>`
    + `<div class="menus_item"><a class="site-page" href="/projects/"><i class="fa-fw fas fa-code-branch"></i><span> Projects</span></a></div>`
    + `<div class="menus_item"><a class="site-page" href="/trending/"><i class="fa-fw fas fa-fire"></i><span> Trending</span></a></div>`
    + `</div>`;

  const siteDataItems = (label, href, count) =>
    `<div class="data-item is-center"><div class="data-item-link"><a href="${href}"><div class="headline">${label}</div><div class="length-num">${count}</div></a></div></div>`;

  const SIDEBAR = ``
    + `<div id="menu-mask"></div>`
    + `<div id="sidebar-menus">`
    + `<div class="avatar-img is-center"><img src="/img/avatar.png" onerror="onerror=null;src='/img/friend_404.gif'" alt="avatar"/></div>`
    + `<div class="site-data">`
    + siteDataItems('文章', '/archives/', postCount)
    + siteDataItems('标签', '/tags/', tagCount)
    + siteDataItems('分类', '/categories/', catCount)
    + `</div><hr/>`
    + nav
    + `</div>`;

  // Recent posts (up to 5)
  const recentPosts = posts.slice(0, 5).map(p => {
    const href  = '/' + p.path;
    const title = (p.title || p.slug || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const cover = p.cover || 'https://cdn.jsdelivr.net/npm/butterfly-extsrc@1/img/default.jpg';
    const dateISO  = p.date ? p.date.toISOString() : '';
    const dateDisp = p.date ? p.date.format('YYYY-MM-DD') : '';
    const dateFull = p.date ? p.date.format('YYYY-MM-DD HH:mm:ss') : '';
    return `<div class="aside-list-item">`
      + `<a class="thumbnail" href="${href}" title="${title}"><img src="${cover}" onerror="this.onerror=null;this.src='/img/friend_404.gif'" alt="${title}"/></a>`
      + `<div class="content"><a class="title" href="${href}" title="${title}">${title}</a>`
      + `<time datetime="${dateISO}" title="发表于 ${dateFull}">${dateDisp}</time></div>`
      + `</div>`;
  }).join('');

  // Categories list (top 10)
  const catItems = categories.slice(0, 10).map(cat => {
    const name = cat.name.replace(/</g, '&lt;');
    return `<li class="card-category-list-item ">`
      + `<a class="card-category-list-link" href="/${cat.path}">`
      + `<span class="card-category-list-name">${name}</span>`
      + `<span class="card-category-list-count">${cat.posts.length}</span>`
      + `</a></li>`;
  }).join('');

  // Tags cloud
  const tagItems = tags.slice(0, 20).map((tag, i) => {
    const size  = (1.0 + i * 0.05).toFixed(2);
    const name  = tag.name.replace(/</g, '&lt;');
    return `<a href="/${tag.path}" style="font-size: ${size}em">${name}</a>`;
  }).join('');

  // Archives by month (group posts)
  const ZH_MONTHS = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
  const byMonth = {};
  for (const p of posts) {
    if (!p.date) continue;
    const key = p.date.format('YYYY/MM');
    byMonth[key] = (byMonth[key] || 0) + 1;
  }
  const archiveItems = Object.keys(byMonth).sort((a, b) => b.localeCompare(a)).map(key => {
    const [yr, mo] = key.split('/');
    const label = `${ZH_MONTHS[parseInt(mo,10)-1]} ${yr}`;
    return `<li class="card-archive-list-item">`
      + `<a class="card-archive-list-link" href="/archives/${key}/">`
      + `<span class="card-archive-list-date">${label}</span>`
      + `<span class="card-archive-list-count">${byMonth[key]}</span>`
      + `</a></li>`;
  }).join('');

  const ASIDE = ``
    + `<div class="card-widget card-info">`
    + `<div class="is-center"><div class="avatar-img"><img src="/img/avatar.png" onerror="this.onerror=null;this.src='/img/friend_404.gif'" alt="avatar"/></div>`
    + `<div class="author-info__name">哎呦，好烦！</div><div class="author-info__description"></div></div>`
    + `<div class="card-info-data">`
    + `<div class="card-info-data-item is-center"><a href="/archives/"><div class="headline">文章</div><div class="length-num">${postCount}</div></a></div>`
    + `<div class="card-info-data-item is-center"><a href="/tags/"><div class="headline">标签</div><div class="length-num">${tagCount}</div></a></div>`
    + `<div class="card-info-data-item is-center"><a href="/categories/"><div class="headline">分类</div><div class="length-num">${catCount}</div></a></div>`
    + `</div>`
    + `<a class="button--animated" id="card-info-btn" target="_blank" rel="noopener" href="https://github.com/iideas18"><i class="fab fa-github"></i><span>Follow Me</span></a>`
    + `<div class="card-info-social-icons is-center">`
    + `<a class="social-icon" href="https://github.com/iideas18" target="_blank" title="Github"><i class="fab fa-github"></i></a>`
    + `<a class="social-icon" href="mailto:i_ideas@outlook.com" target="_blank" title="Email"><i class="fas fa-envelope"></i></a>`
    + `</div></div>`
    + `<div class="card-widget card-announcement"><div class="item-headline"><i class="fas fa-bullhorn card-announcement-animation"></i><span>公告</span></div><div class="announcement_content">Welcome to my Blog</div></div>`
    + `<div class="sticky_layout">`
    + `<div class="card-widget card-recent-post"><div class="item-headline"><i class="fas fa-history"></i><span>最新文章</span></div><div class="aside-list">${recentPosts}</div></div>`
    + `<div class="card-widget card-categories"><div class="item-headline"><i class="fas fa-folder-open"></i><span>分类</span></div><ul class="card-category-list" id="aside-cat-list">${catItems}</ul></div>`
    + `<div class="card-widget card-tags"><div class="item-headline"><i class="fas fa-tags"></i><span>标签</span></div><div class="card-tag-cloud">${tagItems}</div></div>`
    + `<div class="card-widget card-archives"><div class="item-headline"><i class="fas fa-archive"></i><span>归档</span></div><ul class="card-archive-list">${archiveItems}</ul></div>`
    + `<div class="card-widget card-webinfo"><div class="item-headline"><i class="fas fa-chart-line"></i><span>网站资讯</span></div><div class="webinfo">`
    + `<div class="webinfo-item"><div class="item-name">文章数目 :</div><div class="item-count">${postCount}</div></div>`
    + `<div class="webinfo-item"><div class="item-name">已运行时间 :</div><div class="item-count" id="runtimeshow" data-publishDate="2021-08-30T16:00:00.000Z"></div></div>`
    + `<div class="webinfo-item"><div class="item-name">本站总字数 :</div><div class="item-count">${wordStr}</div></div>`
    + `<div class="webinfo-item"><div class="item-name">本站访客数 :</div><div class="item-count" id="busuanzi_value_site_uv"></div></div>`
    + `<div class="webinfo-item"><div class="item-name">本站总访问量 :</div><div class="item-count" id="busuanzi_value_site_pv"></div></div>`
    + `<div class="webinfo-item"><div class="item-name">最后更新时间 :</div><div class="item-count" id="last-push-date" data-lastPushDate="${lastPushDate}"></div></div>`
    + `</div></div>`
    + `</div>`;

  const content = `// partials.js — auto-generated by tools/generate.js — do not edit manually
(function () {
  var SIDEBAR = ${JSON.stringify(SIDEBAR)};
  var ASIDE   = ${JSON.stringify(ASIDE)};

  function inject() {
    var s = document.getElementById('sidebar');
    if (s && s.children.length === 0) s.innerHTML = SIDEBAR;

    var a = document.getElementById('aside-content');
    if (a && a.children.length === 0) a.innerHTML = ASIDE;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }

  document.addEventListener('pjax:complete', inject);
  document.addEventListener('pjax:success',   inject);
})();
`;

  const outPath = path.join(publicDir, 'js', 'partials.js');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, content, 'utf8');
  console.log(`  partials.js written (${postCount} posts, ${catCount} categories, ${tagCount} tags)`);
}

function syncPublicToRoot(hexoRoot) {
  const repoRoot = path.dirname(hexoRoot);
  const publicDir = path.join(hexoRoot, 'public') + '/';
  const args = ['-a', '--delete'];

  for (const pattern of SYNC_ROOT_EXCLUDES) {
    args.push(`--exclude=${pattern}`);
  }

  args.push(publicDir, repoRoot + '/');
  execFileSync('rsync', args, { stdio: 'inherit' });
}

async function main() {
  const hexoRoot = path.resolve(__dirname, '..');
  const shouldSyncRoot = process.argv.includes('--sync-root');
  const hexo = new Hexo(hexoRoot, {});

  await hexo.init();
  await hexo.call('clean', {});
  await hexo.call('generate', {});
  copySourceIntoPublic(hexoRoot);
  buildPartials(hexo, path.join(hexoRoot, 'public'));

  if (shouldSyncRoot) {
    syncPublicToRoot(hexoRoot);
  }

  await hexo.exit();
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
