(() => {
  const button = document.querySelector('.theme-toggle');
  const header = document.querySelector('.site-header');
  const systemTheme = matchMedia('(prefers-color-scheme: dark)');
  const updateLabel = () => {
    const dark = document.documentElement.dataset.theme === 'dark';
    const label = dark ? '切换到浅色模式' : '切换到深色模式';
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-pressed', String(dark));
    button.title = label;
  };
  button.addEventListener('click', () => {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('sora-garden-v2-theme', theme); } catch {}
    updateLabel();
  });
  systemTheme.addEventListener('change', event => {
    let saved;
    try { saved = localStorage.getItem('sora-garden-v2-theme'); } catch {}
    if (saved !== 'light' && saved !== 'dark') {
      document.documentElement.dataset.theme = event.matches ? 'dark' : 'light';
      updateLabel();
    }
  });
  const updateScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 12);
  window.addEventListener('scroll', updateScroll, { passive: true });
  updateLabel();
  updateScroll();
})();
