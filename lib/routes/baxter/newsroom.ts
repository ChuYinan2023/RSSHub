import https from 'node:https';
import zlib from 'node:zlib';

import { load } from 'cheerio';

import type { Data, DataItem, Route } from '@/types';
import { ViewType } from '@/types';
import cache from '@/utils/cache';
import { parseDate } from '@/utils/parse-date';

const baseUrl = 'https://www.baxter.com';

export const route: Route = {
    path: '/newsroom',
    name: 'Newsroom',
    url: 'www.baxter.com/baxter-newsroom',
    maintainers: ['ChuYinan2023'],
    handler,
    example: '/baxter/newsroom',
    parameters: {},
    description: 'Latest news and press releases from Baxter.',
    categories: ['other'],
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportRadar: true,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['www.baxter.com/baxter-newsroom'],
            target: '/newsroom',
        },
    ],
    view: ViewType.Articles,
};

function fetchPage(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const options = {
            protocol: 'https:',
            hostname: parsed.hostname,
            path: parsed.pathname + parsed.search,
            method: 'GET',
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' },
            rejectUnauthorized: false,
        };
        const req = https.request(options, (res) => {
            const encoding = res.headers['content-encoding'];
            let stream: NodeJS.ReadableStream = res;
            switch (encoding) {
                case 'gzip':
                    stream = res.pipe(zlib.createGunzip());

                    break;

                case 'deflate':
                    stream = res.pipe(zlib.createInflate());

                    break;

                case 'br':
                    stream = res.pipe(zlib.createBrotliDecompress());

                    break;

                default:
                // Do nothing
            }
            const chunks: Buffer[] = [];
            stream.on('data', (chunk: Buffer) => {
                chunks.push(chunk);
            });
            stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
            stream.on('error', (e: Error) => reject(e));
        });
        req.on('error', (e: Error) => reject(e));
        req.setTimeout(15000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        req.end();
    });
}

async function handler(): Promise<Data> {
    const listUrl = `${baseUrl}/baxter-newsroom`;
    const html = await fetchPage(listUrl);
    const $ = load(html);

    // Deduplicate by link
    const seen = new Set<string>();
    const listItems: Array<{
        title: string;
        link: string;
        pubDate?: ReturnType<typeof parseDate>;
        category: string;
    }> = [];

    $('div.card--story').each((_, el) => {
        const $el = $(el);
        const $a = $el.find('a.card__inner').first();
        const href = $a.attr('href') || '';
        if (!href || seen.has(href)) {
            return;
        }
        seen.add(href);

        const title = $el.find('h3.arrow-link span').text().trim();
        if (!title) {
            return;
        }

        const link = href.startsWith('http') ? href : `${baseUrl}${href}`;

        // Parse meta: "Press Release • January 21, 2026"
        const meta = $el.find('span.meta').text().trim();
        const parts = meta.split('•');
        const category = parts[0]?.trim() || '';
        const dateText = parts[1]?.trim() || '';
        const pubDate = dateText ? parseDate(dateText) : undefined;

        listItems.push({ title, link, pubDate, category });
    });

    const items: DataItem[] = await Promise.all(
        listItems.slice(0, 20).map(async (item) => {
            const cached = (await cache.tryGet(item.link, async () => {
                try {
                    const detailHtml = await fetchPage(item.link);
                    const $d = load(detailHtml);
                    $d('script, style, p.page-tools').remove();
                    return $d('div.wysiwyg').first().html()?.trim() || '';
                } catch {
                    return '';
                }
            })) as string;

            return {
                ...item,
                description: cached || item.title,
            } as DataItem;
        })
    );

    return {
        title: 'Baxter - Newsroom',
        link: listUrl,
        description: 'Latest news and press releases from Baxter.',
        item: items,
        language: 'en',
        view: ViewType.Articles,
    };
}
