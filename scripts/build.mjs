import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';
import katex from 'katex';
import { prepareFonts } from './prepare-fonts.mjs';

const project = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(project, 'dist');
const config = JSON.parse(fs.readFileSync(path.join(project, 'site.json'), 'utf8'));
const origin = new URL(config.url).href.replace(/\/$/, '');
const categories = ['数学思考', '读书笔记', '日常随笔'];
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const math = (source, displayMode) => katex.renderToString(source, { displayMode, throwOnError: true, strict: 'error', trust: false, output: 'htmlAndMathml' });
const md = new MarkdownIt({ html: false, linkify: true, typographer: true });

md.inline.ruler.after('escape', 'math_inline', (state, silent) => {
  if (state.src[state.pos] !== '$' || state.src[state.pos + 1] === '$') return false;
  const start = state.pos;
  let end = start + 1;
  while ((end = state.src.indexOf('$', end)) !== -1) {
    let escapes = 0;
    for (let i = end - 1; state.src[i] === '\\'; i--) escapes++;
    if (escapes % 2 === 0) break;
    end++;
  }
  if (end < 0 || end === start + 1 || state.src.slice(start + 1, end).includes('\n')) return false;
  if (!silent) { const token = state.push('math_inline', 'math', 0); token.content = state.src.slice(start + 1, end); }
  state.pos = end + 1;
  return true;
});
md.renderer.rules.math_inline = (tokens, index) => math(tokens[index].content, false);
md.block.ruler.before('fence', 'math_block', (state, start, end, silent) => {
  const line = state.src.slice(state.bMarks[start] + state.tShift[start], state.eMarks[start]).trim();
  if (line !== '$$') return false;
  let next = start + 1;
  for (; next < end; next++) {
    if (state.src.slice(state.bMarks[next] + state.tShift[next], state.eMarks[next]).trim() === '$$') break;
  }
  if (next === end) throw new Error('Display math must end with a separate $$ line.');
  if (silent) return true;
  const token = state.push('math_block', 'math', 0);
  token.content = state.getLines(start + 1, next, state.blkIndent, false).trim();
  token.block = true;
  state.line = next + 1;
  return true;
}, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });
md.renderer.rules.math_block = (tokens, index) => `<div class="math-block">${math(tokens[index].content, true)}</div>\n`;

function render(source) {
  const tokens = md.parse(source, {});
  const toc = [];
  const seen = new Map();
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type !== 'heading_open') continue;
    const title = tokens[i + 1].content;
    const base = title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'section';
    const count = (seen.get(base) || 0) + 1;
    seen.set(base, count);
    const id = base + (count > 1 ? `-${count}` : '');
    tokens[i].attrSet('id', id);
    if (tokens[i].tag === 'h2') toc.push({ title, id });
  }
  return { html: md.renderer.render(tokens, md.options, {}), toc };
}

const posts = fs.readdirSync(path.join(project, 'content/posts')).filter(name => name.endsWith('.md')).map(name => {
  const raw = fs.readFileSync(path.join(project, 'content/posts', name), 'utf8').replace(/\r\n/g, '\n');
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error(`${name}: missing front matter.`);
  const meta = Object.fromEntries(match[1].split('\n').map(line => {
    const colon = line.indexOf(':');
    if (colon < 0) throw new Error(`${name}: invalid metadata line.`);
    return [line.slice(0, colon).trim(), line.slice(colon + 1).trim()];
  }));
  for (const key of ['title', 'date', 'category', 'description', 'slug']) if (!meta[key]) throw new Error(`${name}: missing ${key}.`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(meta.slug)) throw new Error(`${name}: invalid slug.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date) || Number.isNaN(Date.parse(meta.date))) throw new Error(`${name}: invalid date.`);
  if (!categories.includes(meta.category)) throw new Error(`${name}: unknown category.`);
  const words = match[2].match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]|[\p{L}\p{N}]+/gu)?.length || 0;
  return { ...meta, demo: meta.demo === 'true', tags: (meta.tags || '').split(/[,，]/).map(s => s.trim()).filter(Boolean), body: match[2], minutes: Math.max(1, Math.ceil(words / 350)), ...render(match[2]) };
}).sort((a, b) => b.date.localeCompare(a.date) || categories.indexOf(a.category) - categories.indexOf(b.category));
if (new Set(posts.map(p => p.slug)).size !== posts.length) throw new Error('Post slugs must be unique.');
fs.mkdirSync(dist, { recursive: true });
// Clear only previously generated pages, after checking the output is inside this project.
if (path.dirname(dist) !== project.replace(/[\\/]$/, '')) throw new Error('Unexpected output directory.');
for (const name of fs.readdirSync(dist)) fs.rmSync(path.join(dist, name), { recursive: true, force: true });
fs.cpSync(path.join(project, 'public'), dist, { recursive: true });
await prepareFonts(dist);
fs.mkdirSync(path.join(dist, 'assets/katex'), { recursive: true });
fs.copyFileSync(path.join(project, 'node_modules/katex/dist/katex.min.css'), path.join(dist, 'assets/katex/katex.min.css'));
fs.cpSync(path.join(project, 'node_modules/katex/dist/fonts'), path.join(dist, 'assets/katex/fonts'), { recursive: true });
fs.copyFileSync(path.join(project, 'node_modules/katex/LICENSE'), path.join(dist, 'assets/katex/LICENSE'));

const arrow = '<span aria-hidden="true">↗</span>';
const dateLabel = date => date.replaceAll('-', '.');
function shell({ title, description = config.description, route = '', active = '', body, article = false, rootOverride }) {
  const depth = route.split('/').filter(Boolean).length;
  const root = rootOverride ?? (depth ? '../'.repeat(depth) : './');
  const url = `${origin}/${route}`;
  const nav = [['', 'Writings', 'writing'], ['archive/', 'Index', 'archive'], ['about/', 'About', 'about']].map(([href, label, key]) => `<a href="${root}${href}"${active === key ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="theme-color" content="#f7f7ef">
<title>${escape(title ? `${title} · ${config.title}` : config.title)}</title><meta name="description" content="${escape(description)}">${config.showDemoNotice ? '<meta name="robots" content="noindex,nofollow">' : ''}<link rel="canonical" href="${escape(url)}"><meta property="og:title" content="${escape(title || config.title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:type" content="${article ? 'article' : 'website'}"><meta property="og:url" content="${escape(url)}"><link rel="icon" href="${root}assets/avatar.svg" type="image/svg+xml"><link rel="alternate" type="application/atom+xml" href="${root}feed.xml" title="${escape(config.title)}"><link rel="preload" href="${root}assets/fonts/SourceHanSerifCN-VF.otf.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="${root}assets/style.css"><link rel="stylesheet" href="${root}assets/backgrounds.css">${article ? `<link rel="stylesheet" href="${root}assets/katex/katex.min.css">` : ''}<script src="${root}assets/theme.js"></script><script src="${root}assets/site.js" defer></script></head>
<body><a class="skip-link" href="#main">跳到正文</a><div class="shell"><header class="site-header"><a class="brand" href="${root}" aria-label="${escape(config.title)}，首页"><img src="${root}assets/avatar.svg" width="38" height="38" alt=""><span>${escape(config.title)}</span></a><div class="header-right"><nav aria-label="主导航">${nav}</nav><button class="theme-toggle" type="button" aria-label="Turn on light mode" title="Turn on dark mode" hidden><svg class="moon" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M20.5 13.2A8.5 8.5 0 0 1 10.8 3.5a8.5 8.5 0 1 0 9.7 9.7Z"/></svg><svg class="sun" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg></button></div></header><main id="main" tabindex="-1">${body}</main><footer class="site-footer"><span>© ${new Date().getUTCFullYear()} ${escape(config.author)}<span class="footer-thought"> · 一页一页，慢慢写。</span></span><a href="${root}feed.xml">RSS 订阅 ${arrow}</a></footer></div><button class="back-top" type="button" aria-label="回到顶部" hidden>↑</button></body></html>`;
}

function postItem(post, root = './') {
  return `<article class="post-item" data-post data-category="${escape(post.category)}" data-search="${escape([post.title, post.description, ...post.tags, post.body].join(' ').toLowerCase())}"><div class="post-date"><time datetime="${post.date}">${dateLabel(post.date)}</time><span>${String(posts.indexOf(post) + 1).padStart(2, '0')}</span></div><div class="post-info"><div class="post-labels"><span class="category">${escape(post.category)}</span>${post.demo ? '<span class="demo-label">排版示例</span>' : ''}<span class="reading-time">约 ${post.minutes} 分钟</span></div><h3><a href="${root}posts/${post.slug}/">${escape(post.title)}${arrow}</a></h3><p>${escape(post.description)}</p><div class="tags">${post.tags.map(tag => `<span># ${escape(tag)}</span>`).join('')}</div></div></article>`;
}

const count = category => posts.filter(p => p.category === category).length;
const home = `<section class="intro" aria-labelledby="intro-title"><div class="intro-copy"><p class="eyebrow"><span class="small-star" aria-hidden="true">✳</span> A PERSONAL NOTEBOOK</p><h1 id="intro-title">把想明白的，<br><span>慢慢写下来。</span></h1><p class="intro-description">你好，我是 ${escape(config.author)}。<br>这里收集数学里的小小发现、书页间的停顿，<br class="desktop-break">以及生活中值得记住的片刻。</p><a class="text-link" href="./about/">关于我和这份手记 <span aria-hidden="true">↗</span></a></div><figure class="intro-art"><img src="./assets/notebook.svg" width="500" height="410" alt="方格纸上的数列示意图：aₙ = 1 − 1/n 随着 n 增大逐渐趋近于 1"><figcaption>一些想法，正在收敛。<span>FIG. 01 — A LITTLE CLOSER</span></figcaption></figure></section>
<section class="writing" aria-labelledby="writing-title"><div class="section-heading"><h2 id="writing-title">最近的手记 <span>Writing</span></h2><a href="./archive/">全部归档 ${arrow}</a></div><div class="writing-tools" hidden><div class="filters" role="group" aria-label="按分类筛选文章"><button type="button" data-filter="all" aria-pressed="true">全部 <span>${posts.length}</span></button>${categories.map(c => `<button type="button" data-filter="${escape(c)}" aria-pressed="false">${escape(c)}</button>`).join('')}</div><label class="search"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><span class="sr-only">搜索手记</span><input type="search" placeholder="找一篇手记…" autocomplete="off" data-search></label></div>
${config.showDemoNotice ? '<p class="demo-notice"><span aria-hidden="true">✎</span> 这份手记刚刚开始。下方文章均为排版示例，等待换上你的第一篇。</p>' : ''}
<div class="writing-layout"><div><div class="post-list">${posts.map(p => postItem(p)).join('')}</div><div class="empty-state" role="status" hidden><p>暂时没有找到这篇手记。</p><button type="button" class="text-link" data-reset>清除搜索，看看全部文章 <span aria-hidden="true">↗</span></button></div><p class="list-end"><span data-results aria-live="polite">共 ${posts.length} 篇${posts.every(p => p.demo) ? '示例手记' : '手记'}</span><span>未完，待续 <span aria-hidden="true">✳</span></span></p></div><aside class="notebook-aside" aria-label="手记索引"><div class="aside-heading"><span>IN THE MARGINS</span><span aria-hidden="true">↙</span></div><p class="aside-thought">不急着有答案，<br>先留下一个<br><em>好问题。</em></p><div class="aside-divider"></div><h3>写在这里的</h3>${categories.map((c, i) => `<a class="aside-category" href="./archive/#${i + 1}"><span><span class="category-dot dot-${i}" aria-hidden="true"></span>${c}</span><span class="mono">${String(count(c)).padStart(2, '0')} ↗</span></a>`).join('')}<p class="aside-note">记录理解发生的过程，<br>也为尚未想清楚的事留一点空白。</p><div class="aside-signature">Sora <span aria-hidden="true">〰</span></div></aside></div></section>`;

function save(route, html) { const output = path.join(dist, route, 'index.html'); fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, html); }
save('', shell({ body: home, active: 'writing' }));
const archive = `<section class="page-layout"><p class="eyebrow">THE INDEX</p><h1>手记归档<span class="heading-dot">。</span></h1><p class="page-description">沿着时间回看，也可以从一个问题出发。</p><div class="archive-overview"><span>${posts.length} 篇${posts.every(p => p.demo) ? '示例手记' : '手记'}</span><span>${categories.length} 个分类</span><a href="../feed.xml">RSS 订阅 ${arrow}</a></div>${categories.map((c, i) => `<section class="archive-category" id="${i + 1}"><div class="archive-heading"><h2><span class="category-dot dot-${i}" aria-hidden="true"></span>${c}</h2><span class="mono">${String(count(c)).padStart(2, '0')}</span></div>${posts.filter(p => p.category === c).map(p => `<a class="archive-entry" href="../posts/${p.slug}/"><time datetime="${p.date}">${dateLabel(p.date)}</time><span>${escape(p.title)}${p.demo ? '<small>排版示例</small>' : ''}</span>${arrow}</a>`).join('') || '<p class="muted">第一篇手记还在路上。</p>'}</section>`).join('')}</section>`;
save('archive', shell({ title: 'Archive', route: 'archive/', active: 'archive', body: archive }));
const about = render(fs.readFileSync(path.join(project, 'content/about.md'), 'utf8')).html;
save('about', shell({ title: '关于', route: 'about/', active: 'about', body: `<section class="about-layout"><aside class="about-mark" aria-label="Sora 的个人手记"><span class="about-monogram">K<span>✳</span></span><span class="mono">A PERSONAL NOTEBOOK</span><p>数学 · 阅读 · 生活</p></aside><div><p class="eyebrow">A NOTE ABOUT ME</p><div class="prose about-prose">${about}</div><a class="text-link" href="../">去读一篇手记 ${arrow}</a></div></section>` }));
for (const post of posts) {
  const index = posts.indexOf(post);
  const neighbors = [posts[index - 1], posts[index + 1]].filter(Boolean);
  const body = `<div class="reading-top"><a class="back-link" href="../../">← 回到手记</a><span class="mono">NOTE ${String(index + 1).padStart(2, '0')}</span></div><article class="reading-layout"><header class="article-header"><div class="post-labels"><span class="category">${escape(post.category)}</span>${post.demo ? '<span class="demo-label">排版示例</span>' : ''}</div><h1>${escape(post.title)}</h1><p class="article-description">${escape(post.description)}</p><div class="article-meta"><span>${escape(config.author)}</span><span aria-hidden="true">·</span><time datetime="${post.date}">${dateLabel(post.date)}</time><span aria-hidden="true">·</span><span>约 ${post.minutes} 分钟</span></div></header><div class="article-columns"><div class="prose">${post.html}</div><aside class="table-of-contents"><p class="mono">ON THIS PAGE</p><nav aria-label="文章目录">${post.toc.map(t => `<a href="#${escape(t.id)}">${escape(t.title)}</a>`).join('')}</nav></aside></div><footer class="article-footer"><div class="tags">${post.tags.map(t => `<span># ${escape(t)}</span>`).join('')}</div><p>写到这里，留一点余地给下一次思考。 <span aria-hidden="true">✳</span></p></footer><nav class="post-neighbors" aria-label="继续阅读">${neighbors.map(p => `<a href="../${p.slug}/"><span>继续翻一页 ${arrow}</span><strong>${escape(p.title)}</strong></a>`).join('')}</nav></article>`;
  save(`posts/${post.slug}`, shell({ title: post.title, description: post.description, route: `posts/${post.slug}/`, body, article: true }));
}
fs.writeFileSync(path.join(dist, '404.html'), shell({ title: '这一页还没写到', rootOverride: new URL(origin + '/').pathname, body: `<section class="page-layout not-found"><p class="eyebrow">PAGE 404</p><h1>这一页，还没写到。</h1><p>也许地址有一点偏差。回到首页，翻开另一篇手记吧。</p><a class="text-link" href="${escape(new URL(origin + '/').pathname)}">回到手记首页 ↗</a></section>` }));
const updated = posts[0] ? `${posts[0].date}T00:00:00+08:00` : '2026-10-26T00:00:00+08:00';
fs.writeFileSync(path.join(dist, 'feed.xml'), `<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>${escape(config.title)}</title><subtitle>${escape(config.description)}</subtitle><link href="${escape(origin)}/feed.xml" rel="self"/><link href="${escape(origin)}/"/><id>${escape(origin)}/</id><updated>${updated}</updated><author><name>${escape(config.author)}</name></author>${posts.map(p => `<entry><title>${escape(p.title)}${p.demo ? ' [排版示例]' : ''}</title><link href="${escape(origin)}/posts/${p.slug}/"/><id>${escape(origin)}/posts/${p.slug}/</id><updated>${p.date}T00:00:00+08:00</updated><summary>${escape(p.description)}</summary><content type="html">${escape(p.html)}</content></entry>`).join('')}</feed>`);
fs.writeFileSync(path.join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="utf-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['', 'archive/', 'about/', ...posts.map(p => `posts/${p.slug}/`)].map(route => `<url><loc>${escape(origin)}/${route}</loc></url>`).join('')}</urlset>`);
fs.writeFileSync(path.join(dist, '.nojekyll'), '');
console.log(`Built ${posts.length} posts, home, archive, about, RSS, and sitemap → dist/`);
