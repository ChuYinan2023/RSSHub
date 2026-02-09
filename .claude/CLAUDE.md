# RSSHub Route Development Guide

This file is the personal development guide for ChuYinan2023, loaded automatically by Claude Code on every conversation.

## RSSHub Route Development Skill

When developing new RSSHub routes, always use the `rsshub-route-developer` skill if available.

## Pre-Development Checklist (Before Writing Code)

1. **Explore the target website thoroughly**
    - Check Network tab in DevTools for hidden APIs (prefer API over HTML scraping)
    - Find the most complete data source (e.g., "SEE ALL" / "Load More" pages with more articles)
    - Don't just scrape the homepage if a full listing page exists
2. **Verify every CSS selector on real pages**
    - Open 3-5 actual article URLs and confirm each selector matches real content
    - Record the test URLs for PR description
3. **Check if the site has anti-crawler measures**
    - If yes, set `antiCrawler: true` in features

## Route Configuration Rules

- `example` field: must start with `/`, must be a RSSHub path (NOT a website URL)
- `name` field: do NOT repeat the namespace name
- `namespace.ts` `url` field: NO `https://` prefix (e.g., `www.tctmd.com`)
- `radar[].source`: NO `https://` prefix
- `radar[].target`: must match the route path
- `categories`: only ONE category
- Do NOT create separate `radar.ts` or `README.md` files — put them inline in the route file
- `maintainers`: must be valid GitHub usernames

## Code Style Rules

- Variable names: `camelCase` (not `snake_case`)
- Type imports: `import type { ... }` for type-only imports
- Do NOT use template literals for plain strings
- Cheerio: call `load()` only once, reuse the `$` object
- Puppeteer: always `await page.close()` and `await browser.close()`
- Omit properties that are `null` — don't explicitly set them
- Arrow functions: always use parentheses around parameters
- Comments: write in English
- Move function definitions to module level, not inside loops/callbacks

## Data Handling Rules

- **Always use `cache.tryGet()`** when fetching article details in a loop
- `description`: ONLY main article content (no title, author, date, tags)
- `category`: extract tags from articles and place here
- `pubDate`: use `parseDate()` utility; if no date available, leave `undefined` (NEVER use `new Date()` as fallback)
- Do NOT trim or truncate titles
- Each item's `link` must be unique (used as `guid`)
- Feed `link` should point to human-readable webpage, NOT API endpoint

## Error Handling Rules

- **Do NOT wrap everything in a big try-catch** — let errors propagate naturally
- RSSHub framework handles errors at a higher level
- Only use try-catch for specific optional fields that may not exist
- Use clear, actionable error messages

## API & Data Fetching Rules

- **Prefer APIs over HTML scraping** when available
- Only request the first page — no pagination
- Use RSSHub built-in `limit` parameter, don't implement custom ones
- Use path parameters (`:param`), not query string parameters
- Use `config.trueUA` for realistic User-Agent headers
- When using `ofetch`, don't manually `JSON.parse` (it's automatic)

## Puppeteer Rules (if needed)

- Set `requirePuppeteer: true` only if actually using Puppeteer
- Limit allowed request types (e.g., `document` only)
- Use `page.waitForSelector()` instead of `setTimeout()`
- Never use Puppeteer inside `Promise.all()` loops

## Media & Enclosures

- `enclosure_type`: must be valid MIME type (e.g., `video/mp4`, NOT `video/youtube`)
- `enclosure_url`: must be direct download URL, not a webpage
- Use `<video poster="...">` for thumbnails, not separate `<img>`
- Do NOT add `referrerpolicy` — middleware handles it

## PR Submission Checklist (Before Submitting)

1. [ ] Route works locally (`npm run dev` → `http://localhost:1200/your/route`)
2. [ ] All CSS selectors verified on real article URLs
3. [ ] `cache.tryGet()` used for article detail fetching
4. [ ] No big try-catch blocks swallowing errors
5. [ ] No separate `radar.ts` file — radar config is inline
6. [ ] `namespace.ts` url has no `https://` prefix
7. [ ] PR description includes:
    - Route path example
    - 2-3 test article URLs showing selectors work
    - Brief explanation of data source (API vs scraping)
8. [ ] Run `npm run format` before committing
9. [ ] Address ALL review comments before requesting re-review
