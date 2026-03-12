(root => {
  root.saveToLocal = {
    set(key, value, ttl) {
      if (ttl === 0) return;
      const now = new Date();
      const item = {
        value,
        expiry: now.getTime() + ttl * 86400000
      };
      localStorage.setItem(key, JSON.stringify(item));
    },
    get(key) {
      const itemStr = localStorage.getItem(key);
      if (!itemStr) return undefined;
      const item = JSON.parse(itemStr);
      if (Date.now() > item.expiry) {
        localStorage.removeItem(key);
        return undefined;
      }
      return item.value;
    }
  };

  root.getScript = url => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.onerror = reject;
    script.onload = script.onreadystatechange = function () {
      const state = this.readyState;
      if (state && state !== 'loaded' && state !== 'complete') return;
      script.onload = script.onreadystatechange = null;
      resolve();
    };
    document.head.appendChild(script);
  });

  root.activateDarkMode = function () {
    document.documentElement.dataset.theme = 'dark';
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute('content', '#0d0d0d');
  };

  root.activateLightMode = function () {
    document.documentElement.dataset.theme = 'light';
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute('content', '#ffffff');
  };

  const theme = root.saveToLocal.get('theme');
  if (theme === 'dark') root.activateDarkMode();
  else if (theme === 'light') root.activateLightMode();

  const asideStatus = root.saveToLocal.get('aside-status');
  if (asideStatus !== undefined) {
    document.documentElement.classList.toggle('hide-aside', asideStatus === 'hide');
  }

  if (root.GLOBAL_CONFIG_SITE && GLOBAL_CONFIG_SITE.isHome && /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent)) {
    document.documentElement.classList.add('apple');
  }
})(globalThis);
