import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../dist/', import.meta.url));
const port = Number(process.env.BLOG_PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.xml': 'application/xml; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const file = path.resolve(root, `.${decodeURIComponent(url.pathname)}`);
    if (file !== path.resolve(root) && !file.startsWith(path.resolve(root) + path.sep)) { res.writeHead(403); res.end(); return; }
    let output = file;
    if (fs.existsSync(output) && fs.statSync(output).isDirectory()) {
      if (!url.pathname.endsWith('/')) { res.writeHead(301, { Location: url.pathname + '/' + url.search }); res.end(); return; }
      output = path.join(output, 'index.html');
    }
    if (!fs.existsSync(output) || !fs.statSync(output).isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(path.join(root, '404.html'))); return;
    }
    res.writeHead(200, { 'Content-Type': types[path.extname(output)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    fs.createReadStream(output).pipe(res);
  } catch { res.writeHead(400); res.end('Invalid request'); }
});
server.listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}/`));
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
process.on('SIGINT', () => server.close());
