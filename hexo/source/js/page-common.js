(() => {
  function initPangu() {
    if (typeof panguFn !== 'function') return;
    if (!globalThis.GLOBAL_CONFIG_SITE || !GLOBAL_CONFIG_SITE.isPost) {
      panguFn();
      return;
    }
    panguFn();
  }

  function endLoading() {
    const loadingBox = document.getElementById('loading-box');
    document.body.style.overflow = 'auto';
    if (loadingBox) loadingBox.classList.add('loaded');
  }

  async function initMermaid() {
    if (!document.getElementsByClassName('mermaid').length) return;

    if (globalThis.mermaidJsLoad && globalThis.mermaid) {
      globalThis.mermaid.init();
      return;
    }

    try {
      await getScript('https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js');
      globalThis.mermaidJsLoad = true;
      globalThis.mermaid.initialize({ theme: 'default' });
      globalThis.mermaid.init();
    } catch (error) {
      console.error('Failed to initialize mermaid.', error);
    }
  }

  function initPowerMode() {
    if (!globalThis.POWERMODE) return;
    globalThis.POWERMODE.colorful = true;
    globalThis.POWERMODE.shake = true;
    globalThis.POWERMODE.mobile = false;
    document.body.addEventListener('input', globalThis.POWERMODE);
  }

  document.addEventListener('DOMContentLoaded', () => {
    initPangu();
    initMermaid();
    initPowerMode();
  });

  globalThis.addEventListener('load', endLoading);
})();
