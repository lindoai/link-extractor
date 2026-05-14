import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { parseHTML } from 'linkedom';
import { readTurnstileTokenFromUrl, verifyTurnstileToken } from '../../_shared/turnstile';
import { renderTextToolPage, turnstileSiteKeyFromEnv } from '../../_shared/tool-page';

type Env = { Bindings: { TURNSTILE_SITE_KEY?: string; TURNSTILE_SECRET_KEY?: string } };

const app = new Hono<Env>();
app.use('/api/*', cors());
app.get('/', (c) =>
  c.html(
    renderTextToolPage({
      title: 'Link Extractor',
      description: 'Extract internal and external links from any public page.',
      endpoint: '/api/extract',
      sample: '{ "url": "https://example.com", "links": [] }',
      siteKey: turnstileSiteKeyFromEnv(c.env),
      buttonLabel: 'Extract',
      toolSlug: 'link-extractor',
    })
  )
);
app.get('/health', (c) => c.json({ ok: true }));
app.get('/api/extract', async (c) => {
  const captcha = await verifyTurnstileToken(
    c.env,
    readTurnstileTokenFromUrl(c.req.url),
    c.req.header('CF-Connecting-IP')
  );
  if (!captcha.ok) return c.json({ error: captcha.error }, 403);

  const normalized = normalizeUrl(c.req.query('url') ?? '');
  if (!normalized) return c.json({ error: 'A valid http(s) URL is required.' }, 400);

  const html = await fetchHtml(normalized);
  if (!html) return c.json({ error: 'Failed to fetch page.' }, 502);

  const { document } = parseHTML(html);
  const base = new URL(normalized);
  const links: { href: string; text: string; type: 'internal' | 'external' }[] = [];
  const seen = new Set<string>();

  document.querySelectorAll('a[href]').forEach((el: any) => {
    const href = el.getAttribute('href')?.trim() ?? '';
    if (
      !href ||
      href.startsWith('#') ||
      href.startsWith('javascript:') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:')
    )
      return;
    let absolute: string;
    try {
      absolute = new URL(href, base).toString();
    } catch {
      return;
    }
    if (seen.has(absolute)) return;
    seen.add(absolute);
    const text = (el.textContent || '').trim().slice(0, 200);
    const type: 'internal' | 'external' =
      new URL(absolute).hostname === base.hostname ? 'internal' : 'external';
    links.push({ href: absolute, text, type });
  });

  return c.json({
    url: normalized,
    total: links.length,
    internal: links.filter((l) => l.type === 'internal').length,
    external: links.filter((l) => l.type === 'external').length,
    links,
  });
});

async function fetchHtml(url: string) {
  const r = await fetch(url, {
    headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': 'Lindo Free Tools/1.0 (+https://lindo.ai/tools)' },
  }).catch(() => null);
  return r?.ok ? r.text() : null;
}

function normalizeUrl(value: string): string | null {
  try {
    return new URL(value.startsWith('http') ? value : `https://${value}`).toString();
  } catch {
    return null;
  }
}

export default app;
