import https from 'node:https';
import zlib from 'node:zlib';

import { load } from 'cheerio';

import type { Data, DataItem, Route } from '@/types';
import { ViewType } from '@/types';
import cache from '@/utils/cache';
import { parseDate } from '@/utils/parse-date';

const baseUrl = 'https://eurointervention.pcronline.com';

export const route: Route = {
    path: '/latest',
    name: 'Latest Issue',
    url: 'eurointervention.pcronline.com',
    maintainers: ['ChuYinan2023'],
    handler,
    example: '/eurointervention/latest',
    parameters: {},
    description: 'Latest issue articles from EuroIntervention journal.',
    categories: ['journal'],
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
            source: ['eurointervention.pcronline.com/issues/latest', 'eurointervention.pcronline.com/'],
            target: '/latest',
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
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Accept-Language': 'en-US,en;q=0.9',
            },
            rejectUnauthorized: false,
        };
        const req = https.request(options, (res) => {
            // Follow redirects
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                const redirectUrl = res.headers.location.startsWith('http') ? res.headers.location : `${baseUrl}${res.headers.location}`;
                res.resume();
                fetchPage(redirectUrl).then(resolve, reject);
                return;
            }
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
                // No decompression needed
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
    const html = await fetchPage(`${baseUrl}/issues/latest`);
    const $ = load(html);

    const issueTitle = $('title')
        .text()
        .replace(/\s*\|\s*EuroIntervention.*$/, '')
        .trim();

    // Extract issue date from nav links like "Volume 22 Number 3 (Feb 2, 2026)"
    let issueDate: Date | undefined;
    $('a[href^="/issue/"]').each((_, el) => {
        const text = $(el).text().trim();
        const dateMatch = text.match(/\(([^)]+)\)/);
        if (dateMatch && !issueDate) {
            try {
                issueDate = parseDate(dateMatch[1]);
            } catch {
                // ignore parse errors
            }
        }
    });

    // Parse article cards
    let currentCategory = '';
    const items: DataItem[] = [];
    const seen = new Set<string>();

    // Walk through the content in order to track section headings
    $('h2, h3, div.w-full.mb-5').each((_, el) => {
        const $el = $(el);
        const tag = $el.prop('tagName');

        if (tag === 'H2' || tag === 'H3') {
            const text = $el.text().trim();
            if (text !== 'issue' && text.length > 2 && text.length < 80) {
                currentCategory = text;
            }
            return;
        }

        // Article card
        const $link = $el.find('a[href^="/article/"]').first();
        if (!$link.length) {
            return;
        }

        const href = $link.attr('href') || '';
        const link = `${baseUrl}${href}`;
        if (seen.has(link)) {
            return;
        }
        seen.add(link);

        const title = $link.text().trim();
        const children = $el.children('div');
        const authorText = children.eq(0).text().trim();
        const doiText = children.eq(1).text().trim();
        const doi = /^10\.\d{4,}\//.test(doiText) ? doiText : undefined;

        const description = authorText ? `<p><strong>Authors:</strong> ${authorText}</p>` : title;

        items.push({
            title,
            link,
            pubDate: issueDate,
            description,
            author: authorText || undefined,
            doi,
            category: currentCategory ? [currentCategory] : undefined,
        } as DataItem);
    });

    // Fetch abstracts from article detail pages
    const detailedItems = await Promise.all(
        items.map((item) =>
            cache.tryGet(item.link as string, async () => {
                const articleHtml = await fetchPage(item.link as string);
                const $article = load(articleHtml);

                const ogDesc = $article('meta[property="og:description"], meta[name="og:description"]').attr('content');
                if (ogDesc) {
                    const authorPart = item.author ? `<p><strong>Authors:</strong> ${item.author}</p>` : '';
                    item.description = `${authorPart}<p>${ogDesc}</p>`;
                }

                return item;
            })
        )
    );

    return {
        title: `EuroIntervention - ${issueTitle}`,
        link: `${baseUrl}/issues/latest`,
        description: 'Latest issue from EuroIntervention journal.',
        item: detailedItems as DataItem[],
        language: 'en',
        view: ViewType.Articles,
    };
}
