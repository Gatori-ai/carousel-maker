// The local page. Listens on 127.0.0.1 only.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import * as store from './store.mjs';
import * as engine from './engine.mjs';
import { buildHtml, findChrome, render } from './render.mjs';

const { p, read, REPO } = store;

// The only files the page can ask for by name.
const STATIC = {
  '/ink.css': ['web/ink.css', 'text/css; charset=utf-8'],
  '/assets/gatori-enso.png': ['assets/gatori-enso.png', 'image/png'],
};

const PAGE_CSP = "default-src 'none'; style-src 'self' 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src 'self'; base-uri 'none'; form-action 'none'";

function send(res, code, body, type = 'application/json; charset=utf-8', extra = {}) {
  const text = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra });
  res.end(text);
}

function body(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 1_000_000) {
        reject(Object.assign(new Error('Request too large.'), { code: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch {
        reject(Object.assign(new Error('Body is not valid JSON.'), { code: 400 }));
      }
    });
    req.on('error', reject);
  });
}

// One long job at a time keeps two clicks from writing the same carousel at once.
let chain = Promise.resolve();
let busy = null;
function queued(label, fn) {
  const run = chain.then(async () => {
    busy = label;
    try {
      return await fn();
    } finally {
      busy = null;
    }
  });
  chain = run.catch(() => {});
  return run;
}

const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function createServer({ complete } = {}) {
  const opts = complete ? { complete } : {};
  const view = (id) => ({ carousel: store.loadCarousel(id), issues: engine.report(id), images: store.images(id), dir: p.dir(id) });
  const routes = {
    'GET /api/state': async () => ({
      status: engine.status(),
      busy,
      brand: store.loadBrand(),
      context: read(p.context()),
      notes: read(p.notes()),
      arcs: store.arcs(),
      types: store.slideTypes(),
      themes: store.themes(),
      carousels: store.listCarousels().slice(0, 100),
    }),
    'GET /api/carousel': async (_b, q) => view(q.get('id')),
    'POST /api/setup': async (b) => {
      const brand = store.init({ name: text(b.name, 80), handle: text(b.handle, 41) });
      if (store.themes().includes(b.theme)) brand.theme = b.theme;
      if (/^#[0-9a-f]{6}$/i.test(b.accent || '')) brand.accent = b.accent.toLowerCase();
      if (typeof b.keyword === 'string') brand.cta.keyword = text(b.keyword, 40);
      if (typeof b.promise === 'string') brand.cta.promise = text(b.promise, 200);
      store.saveBrand(brand);
      if (typeof b.context === 'string' && b.context.trim()) store.write(p.context(), b.context.trim() + '\n');
      return { ok: true };
    },
    'POST /api/new': async (b) => queued('Writing the carousel', () => engine.make({ topic: text(b.topic, 300), arc: text(b.arc, 40), ...opts })),
    'POST /api/revise': async (b) =>
      queued('Rewriting from your note', () => engine.revise({ id: b.id, note: text(b.note, 2000), remember: b.remember === true, ...opts })),
    'POST /api/save': async (b) => {
      const current = store.loadCarousel(b.id);
      store.saveCarousel({ ...b.carousel, id: b.id, created: current.created, status: current.status });
      return view(b.id);
    },
    'POST /api/render': async (b) => {
      await queued('Making the images', () => render(store.safeId(b.id)));
      return view(b.id);
    },
    'POST /api/approve': async (b) => {
      engine.approve(b.id);
      return view(b.id);
    },
  };

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      // A page on another site must not be able to drive this server.
      const host = (req.headers.host || '').split(':')[0];
      if (!['localhost', '127.0.0.1', '[::1]'].includes(host)) return send(res, 403, { error: 'Local use only.' });
      if (req.method === 'POST') {
        const origin = req.headers.origin;
        if (origin && !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin)) {
          return send(res, 403, { error: 'Cross-site request refused.' });
        }
        if (!(req.headers['content-type'] || '').startsWith('application/json')) {
          return send(res, 415, { error: 'Send JSON.' });
        }
      } else if (req.method !== 'GET') return send(res, 405, { error: 'GET and POST only.' });

      if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
        return send(res, 200, read(path.join(REPO, 'web', 'index.html')), 'text/html; charset=utf-8', { 'Content-Security-Policy': PAGE_CSP });
      }
      if (req.method === 'GET' && STATIC[url.pathname]) {
        const [file, type] = STATIC[url.pathname];
        return send(res, 200, fs.readFileSync(path.join(REPO, file)), type);
      }
      // The slides of one carousel, as the same HTML the images are taken from.
      if (req.method === 'GET' && url.pathname === '/slides') {
        return send(res, 200, buildHtml(store.loadCarousel(url.searchParams.get('id'))), 'text/html; charset=utf-8');
      }
      if (req.method === 'GET' && url.pathname === '/image') {
        const id = store.safeId(url.searchParams.get('id'));
        const n = String(parseInt(url.searchParams.get('n'), 10) || 0).padStart(2, '0');
        const file = path.join(p.dir(id), `slide-${n}.png`);
        if (!/^\d\d$/.test(n) || !fs.existsSync(file)) return send(res, 404, { error: 'No such image.' });
        return send(res, 200, fs.readFileSync(file), 'image/png', { 'Content-Disposition': `attachment; filename="${id}-slide-${n}.png"` });
      }
      const handler = routes[`${req.method} ${url.pathname}`];
      if (!handler) return send(res, 404, { error: 'Not found.' });
      const input = req.method === 'POST' ? await body(req) : {};
      store.init();
      return send(res, 200, await handler(input, url.searchParams));
    } catch (e) {
      return send(res, e.code && Number.isInteger(e.code) ? e.code : 400, { error: e.message });
    }
  });
}

export function serve({ port } = {}) {
  const brand = store.loadBrand();
  const usePort = Number(port || process.env.PORT || brand.port);
  store.init();
  const server = createServer();
  server.requestTimeout = 0;
  server.headersTimeout = 60_000;
  server.timeout = 0;
  server.listen(usePort, '127.0.0.1', () => {
    console.log(`Carousel Maker is at http://localhost:${usePort}/`);
    console.log(`Studio folder: ${store.home()}`);
    if (!findChrome()) console.log('No Chrome, Edge, Brave or Chromium found: the page previews slides, and images need one of them.');
  });
  server.on('error', (e) => {
    console.error(e.code === 'EADDRINUSE' ? `Port ${usePort} is taken. Run: carousel serve --port <other>` : e.message);
    process.exit(1);
  });
  return server;
}
