import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';
import katex from 'katex';
import { prepareFonts } from './prepare-fonts.mjs';
import { build as bundle } from 'esbuild';
import { authConfig } from '../public/v2/assets/auth-config.js';
import { validateAuthConfig } from './auth-settings.mjs';

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
  return { ...meta, demo: meta.demo === 'true', tags: (meta.tags || '').split(/[,，]/).map(s => s.trim()).filter(Boolean), body: match[2], ...render(match[2]) };
}).sort((a, b) => b.date.localeCompare(a.date) || categories.indexOf(a.category) - categories.indexOf(b.category));
if (new Set(posts.map(p => p.slug)).size !== posts.length) throw new Error('Post slugs must be unique.');
fs.mkdirSync(dist, { recursive: true });
// Clear only previously generated pages, after checking the output is inside this project.
if (path.dirname(dist) !== project.replace(/[\\/]$/, '')) throw new Error('Unexpected output directory.');
for (const name of fs.readdirSync(dist)) fs.rmSync(path.join(dist, name), { recursive: true, force: true });
fs.cpSync(path.join(project, 'public'), dist, { recursive: true });
// Page templates are read from public/v2, but only the main site publishes them.
for (const template of ['index.html', 'posts/index.html', 'about/index.html']) {
  fs.unlinkSync(path.join(dist, 'v2', template));
}
await prepareFonts(dist);
validateAuthConfig(authConfig);
await bundle({
  entryPoints: [path.join(project, 'scripts/browser/auth.mjs')],
  outfile: path.join(dist, 'v2/assets/auth.js'),
  bundle: true, format: 'esm', platform: 'browser', target: 'es2022',
  minify: true, legalComments: 'linked',
});
const accountVersion = createHash('sha256').update(fs.readFileSync(path.join(dist, 'v2/assets/auth.js'))).digest('hex').slice(0, 12);


fs.mkdirSync(path.join(dist, 'assets/katex'), { recursive: true });
fs.copyFileSync(path.join(project, 'node_modules/katex/dist/katex.min.css'), path.join(dist, 'assets/katex/katex.min.css'));
fs.cpSync(path.join(project, 'node_modules/katex/dist/fonts'), path.join(dist, 'assets/katex/fonts'), { recursive: true });
fs.copyFileSync(path.join(project, 'node_modules/katex/LICENSE'), path.join(dist, 'assets/katex/LICENSE'));

const dateLabel = date => date.replaceAll('-', '.');
const about = render(fs.readFileSync(path.join(project, 'content/about.md'), 'utf8')).html;
function save(route, html) {
  const output = path.join(dist, route, 'index.html');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, html);
}

// The second design now renders the main site, using its existing theme assets.
const v2StyleVersion = createHash('sha256')
  .update(fs.readFileSync(path.join(project, 'public/v2/assets/style.css')))
  .digest('hex').slice(0, 12);

function savePage(route, { title, description = config.description, body, active = 'posts', article = false, notFound = false }) {
  const depth = route.split('/').filter(Boolean).length;
  const root = notFound ? '/' : (depth ? '../'.repeat(depth) : './');
  const templateRoute = article || !route || notFound ? 'index.html' : `${route}/index.html`;
  const templateUrl = new URL(`v2/${templateRoute}`, `${origin}/`);
  const template = fs.readFileSync(path.join(project, 'public/v2', templateRoute), 'utf8');
  let html = template.replace(/(href|src)="(\.\.?\/[^"#]*)"/g, (_, attribute, value) => {
    const target = new URL(value, templateUrl);
    if (target.pathname.startsWith('/v2/') && !target.pathname.startsWith('/v2/assets/')) {
      target.pathname = target.pathname.slice('/v2'.length);
    }
    return `${attribute}="${target.pathname}${target.search}${target.hash}"`;
  });
  html = html.replace(/<title>[^<]*<\/title>/, () => `<title>${escape(title)} · ${escape(config.title)}</title>`);
  html = html.replace(/<meta name="description" content="[^"]*">/, () =>
    `<meta name="description" content="${escape(description)}">`);
  html = html.replace(/ aria-current="page"/g, '');
  const activeHref = { home: '/index.html', posts: '/posts/index.html', about: '/about/index.html' }[active];
  html = html.replace(`class="nav-link" href="${activeHref}"`, () =>
    `class="nav-link" href="${activeHref}" aria-current="page"`);
  html = html.replace(/assets\/style\.css\?v=[^"\s]+/g, `assets/style.css?v=${v2StyleVersion}`);
  html = html.replace(/assets\/auth\.js\?v=[^"\s]+/g, `assets/auth.js?v=${accountVersion}`);
  if (!config.showDemoNotice && !notFound) {
    html = html.replace(/\s*<meta name="robots" content="noindex,nofollow">/, '');
  }
  const pageUrl = `${origin}/${route ? `${route}/` : ''}`;
  const metadata = notFound ? '' : `
    <link rel="canonical" href="${escape(pageUrl)}">
    <link rel="alternate" type="application/atom+xml" href="${root}feed.xml" title="${escape(config.title)}">
    <meta property="og:title" content="${escape(title)}">
    <meta property="og:description" content="${escape(description)}">
    <meta property="og:type" content="${article ? 'article' : 'website'}">
    <meta property="og:url" content="${escape(pageUrl)}">`;
  const mathStyle = article ? `<link rel="stylesheet" href="${root}assets/katex/katex.min.css">` : '';
  html = html.replace('</head>', () => `${metadata}${mathStyle}</head>`);
  const mainClass = article ? 'page-content reading-content' : 'page-content';
  html = html.replace(/<main class="page-content"[\s\S]*?<\/main>/, () => `
  <main class="${mainClass}" id="main" tabindex="-1">${body}</main>
  <footer class="site-footer">
    <span>© ${new Date().getUTCFullYear()} ${escape(config.author)}</span>
    <a href="${root}feed.xml">RSS 订阅</a>
  </footer>`);
  if (notFound) fs.writeFileSync(path.join(dist, '404.html'), html);
  else save(route, html);
}

function v2Entry(post, root) {
  return `<article class="entry">
    <time class="entry-date" datetime="${post.date}" aria-label="${dateLabel(post.date)}">
      <span>${post.date.slice(5).replace('-', '.')}</span><small>${post.date.slice(0, 4)}</small>
    </time>
    <div>
      <p class="entry-category">${escape(post.category)}${post.demo ? '（排版示例）' : ''}</p>
      <h3><a href="${root}${post.slug}/">${escape(post.title)}</a></h3>
      <p class="entry-summary">${escape(post.description)}</p>
    </div>
  </article>`;
}

const v2DemoNotice = config.showDemoNotice && posts.some(post => post.demo)
  ? '<p class="demo-note">下方标注的文章为排版示例，等待换上你的第一篇手记。</p>' : '';
savePage('', {
  title: 'Home', active: 'home',
  body: `<section class="welcome">
    <h1>你好，我是 ${escape(config.author)}。</h1>
    <p>${escape(config.description)}</p>
    <a href="./about/">关于这份手记</a>
  </section>
  <section aria-labelledby="recent-title">
    <div class="section-heading"><h2 id="recent-title">最近的手记</h2><a href="./posts/">全部文章</a></div>
    ${v2DemoNotice}
    ${posts.length
      ? posts.slice(0, 5).map(post => v2Entry(post, './posts/')).join('')
      : '<p class="demo-note">第一篇手记还在准备中。</p>'}
  </section>`
});

const v2Years = [...new Set(posts.map(post => post.date.slice(0, 4)))];
savePage('posts', {
  title: 'Posts',
  body: `<header class="page-heading"><h1>手记</h1><p>数学思考、读书笔记和日常随笔。</p></header>
  ${v2DemoNotice}
  ${v2Years.map(year => `<section aria-labelledby="year-${year}">
    <h2 class="archive-year" id="year-${year}">${year}</h2>
    ${posts.filter(post => post.date.startsWith(year)).map(post => v2Entry(post, './')).join('')}
  </section>`).join('')}
  ${posts.length ? '' : '<p class="demo-note">第一篇手记还在准备中。</p>'}`
});

savePage('about', {
  title: 'About', active: 'about',
  body: `<section class="prose about-content">${about.replace(
    '<h1 id="你好-我是-kisaki">你好，我是 Kisaki。</h1>',
    () => `<h1>你好，我是 ${escape(config.author)}。</h1>`
  )}</section>`
});

for (const [index, post] of posts.entries()) {
  const neighbors = [[posts[index - 1], '上一篇'], [posts[index + 1], '下一篇']]
    .filter(([item]) => item);
  const toc = post.toc.length ? `<aside class="article-toc" aria-label="文章目录">
    <p>本文目录</p>
    <nav>${post.toc.map(item => `<a href="#${escape(item.id)}">${escape(item.title)}</a>`).join('')}</nav>
  </aside>` : '';
  savePage(`posts/${post.slug}`, {
    title: post.title, description: post.description, article: true,
    body: `<a class="reading-back" href="../">返回手记</a>
    <div class="reading-layout${toc ? '' : ' reading-layout--plain'}">
      <article class="article">
        <header class="article-header">
          <p class="entry-category">${escape(post.category)}${post.demo ? '（排版示例）' : ''}</p>
          <h1>${escape(post.title)}</h1>
          <p class="article-description">${escape(post.description)}</p>
          <div class="article-meta"><span>${escape(config.author)}</span><time datetime="${post.date}">${dateLabel(post.date)}</time></div>
        </header>
        <div class="prose">${post.html}</div>
        <footer class="article-end">${post.tags.map(tag => `<span># ${escape(tag)}</span>`).join('')}</footer>
        <nav class="post-neighbors" aria-label="继续阅读">
          ${neighbors.map(([item, label]) => `<a href="../${item.slug}/"><span>${label}</span>${escape(item.title)}</a>`).join('')}
        </nav>
      </article>
      ${toc}
    </div>`
  });
}


// Preserve the original archive entrance.
function saveRedirect(route, target) {
  save(route, `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>前往 ${escape(config.title)}</title><meta name="robots" content="noindex,follow">
<meta http-equiv="refresh" content="0;url=${escape(target)}"><link rel="canonical" href="${escape(origin + target)}">
<script>location.replace(${JSON.stringify(target)} + location.search + location.hash);</script></head>
<body><p><a href="${escape(target)}">前往 ${escape(config.title)}</a></p></body></html>`);
}

saveRedirect('archive', '/posts/');
savePage('', {
  title: '这一页还没写到', notFound: true, active: 'home',
  body: '<section class="page-heading"><h1>这一页，还没写到。</h1><p>可以回到首页，翻开另一篇手记。</p><a class="reading-back" href="/">回到首页</a></section>'
});

const updated = posts[0] ? `${posts[0].date}T00:00:00+08:00` : '2026-10-26T00:00:00+08:00';
fs.writeFileSync(path.join(dist, 'feed.xml'), `<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>${escape(config.title)}</title><subtitle>${escape(config.description)}</subtitle><link href="${escape(origin)}/feed.xml" rel="self"/><link href="${escape(origin)}/"/><id>${escape(origin)}/</id><updated>${updated}</updated><author><name>${escape(config.author)}</name></author>${posts.map(p => `<entry><title>${escape(p.title)}${p.demo ? ' [排版示例]' : ''}</title><link href="${escape(origin)}/posts/${p.slug}/"/><id>${escape(origin)}/posts/${p.slug}/</id><updated>${p.date}T00:00:00+08:00</updated><summary>${escape(p.description)}</summary><content type="html">${escape(p.html)}</content></entry>`).join('')}</feed>`);
fs.writeFileSync(path.join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="utf-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['', 'posts/', 'about/', ...posts.map(p => `posts/${p.slug}/`)].map(route => `<url><loc>${escape(origin)}/${route}</loc></url>`).join('')}</urlset>`);
fs.writeFileSync(path.join(dist, '.nojekyll'), '');
console.log(`Built ${posts.length} posts, home, post index, about, redirects, RSS, and sitemap → dist/`);
