(() => {
  try {
    const saved = localStorage.getItem('kisaki-theme');
    const theme = saved === 'dark' || saved === 'light' ? saved : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = theme;
  } catch { /* System color preference is handled by the stylesheet. */ }
})();
