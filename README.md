# Link Extractor

Extract internal and external links from any public page.

## API

```
GET /api/extract?url=https://example.com
```

Returns a JSON list of links with href, text, and type.

## Deploy

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/lindoai/link-extractor)

## Environment

- `TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`
