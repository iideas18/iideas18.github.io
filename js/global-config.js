const GLOBAL_CONFIG = {
  root: '/',
  algolia: undefined,
  localSearch: {
    path: 'search.xml',
    languages: {
      hits_empty: '找不到您查询的内容：${query}'
    }
  },
  translate: undefined,
  noticeOutdate: undefined,
  highlight: {
    plugin: 'highlighjs',
    highlightCopy: true,
    highlightLang: true,
    highlightHeightLimit: false
  },
  copy: {
    success: '复制成功',
    error: '复制错误',
    noSupport: '浏览器不支持'
  },
  relativeDate: {
    homepage: false,
    post: false
  },
  runtime: '天',
  date_suffix: {
    just: '刚刚',
    min: '分钟前',
    hour: '小时前',
    day: '天前',
    month: '个月前'
  },
  copyright: undefined,
  lightbox: 'mediumZoom',
  Snackbar: {
    chs_to_cht: '你已切换为繁体',
    cht_to_chs: '你已切换为简体',
    day_to_night: '你已切换为深色模式',
    night_to_day: '你已切换为浅色模式',
    bgLight: '#49b1f5',
    bgDark: '#121212',
    position: 'bottom-left'
  },
  source: {
    jQuery: 'https://cdn.jsdelivr.net/npm/jquery@latest/dist/jquery.min.js',
    justifiedGallery: {
      js: 'https://cdn.jsdelivr.net/npm/justifiedGallery/dist/js/jquery.justifiedGallery.min.js',
      css: 'https://cdn.jsdelivr.net/npm/justifiedGallery/dist/css/justifiedGallery.min.css'
    },
    fancybox: {
      js: 'https://cdn.jsdelivr.net/npm/@fancyapps/fancybox@latest/dist/jquery.fancybox.min.js',
      css: 'https://cdn.jsdelivr.net/npm/@fancyapps/fancybox@latest/dist/jquery.fancybox.min.css'
    }
  },
  isPhotoFigcaption: false,
  islazyload: false,
  isanchor: false
};
