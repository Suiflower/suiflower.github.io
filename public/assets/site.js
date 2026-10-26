(() => {
  const theme = document.querySelector('.theme-toggle');
  const dark = () => document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  const updateThemeLabel = () => {
    const label = dark() ? '切换到浅色模式' : '切换到深色模式';
    theme.setAttribute('aria-label', label); theme.title = label;
  };
  if (theme) {
    theme.hidden = false; updateThemeLabel();
    theme.addEventListener('click', () => {
      const value = dark() ? 'light' : 'dark';
      document.documentElement.dataset.theme = value;
      try { localStorage.setItem('kisaki-theme', value); } catch { /* Theme still works without storage. */ }
      updateThemeLabel();
    });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateThemeLabel);
  }
  const tools = document.querySelector('.writing-tools');
  if (tools) {
    tools.hidden = false;
    const input = tools.querySelector('[data-search]');
    const filters = [...tools.querySelectorAll('[data-filter]')];
    const posts = [...document.querySelectorAll('[data-post]')];
    const empty = document.querySelector('.empty-state');
    const results = document.querySelector('[data-results]');
    let category = 'all';
    function filter() {
      const query = input.value.trim().toLocaleLowerCase();
      let visible = 0;
      for (const post of posts) {
        const matches = (category === 'all' || post.dataset.category === category) && post.dataset.search.includes(query);
        post.hidden = !matches; visible += Number(matches);
      }
      empty.hidden = visible !== 0;
      results.textContent = `共 ${visible} 篇手记`;
      for (const button of filters) button.setAttribute('aria-pressed', String(button.dataset.filter === category));
    }
    for (const button of filters) button.addEventListener('click', () => { category = button.dataset.filter; filter(); });
    input.addEventListener('input', filter);
    document.querySelector('[data-reset]').addEventListener('click', () => { category = 'all'; input.value = ''; filter(); input.focus(); });
    input.addEventListener('keydown', event => { if (event.key === 'Escape') { input.value = ''; filter(); } });
  }
  const back = document.querySelector('.back-top');
  if (back) {
    const update = () => { back.hidden = window.scrollY < 500; };
    window.addEventListener('scroll', update, { passive: true }); update();
    back.addEventListener('click', () => window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }));
  }
})();
