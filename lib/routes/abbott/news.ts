import { load } from 'cheerio';

import type { Data, DataItem, Route } from '@/types';
import { ViewType } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const baseUrl = 'https://www.abbott.com';

export const route: Route = {
    path: '/news',
    name: 'Newsroom',
    url: 'www.abbott.com/en-us/corpnewsroom',
    maintainers: ['ChuYinan2023'],
    handler,
    example: '/abbott/news',
    parameters: {},
    description: 'Latest news and press releases from Abbott.',
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
            source: ['www.abbott.com/en-us/corpnewsroom', 'www.abbott.com/en-us/corpnewsroom.html'],
            target: '/news',
        },
    ],
    view: ViewType.Articles,
};

async function handler(): Promise<Data> {
    const listUrl = `${baseUrl}/en-us/corpnewsroom`;
    const html = await ofetch(listUrl);
    const $ = load(html);

    const seen = new Set<string>();
    const listItems: Array<{
        title: string;
        link: string;
        category: string;
        pubDate?: ReturnType<typeof parseDate>;
    }> = [];

    $('section.card__wrapper').each((_, el) => {
        const $el = $(el);
        const href = $el.find('a.card__href').attr('href') || '';
        if (!href || seen.has(href)) {
            return;
        }
        seen.add(href);

        const title = $el.find('.card__title').text().trim();
        const eyebrow = $el.find('.card__eyebrow').text().trim();
        if (!title) {
            return;
        }

        const link = href.startsWith('http') ? href : `${baseUrl}${href}`;

        // Extract date from mediaroom URL pattern: /YYYY-MM-DD-
        const dateMatch = href.match(/\/(\d{4}-\d{2}-\d{2})-/);
        const pubDate = dateMatch ? parseDate(dateMatch[1]) : undefined;

        listItems.push({ title, link, category: eyebrow, pubDate });
    });

    const items: DataItem[] = await Promise.all(
        listItems.slice(0, 20).map(async (item) => {
            // Only fetch detail for abbott.com internal links
            if (!item.link.startsWith(baseUrl)) {
                return {
                    ...item,
                    description: item.title,
                } as DataItem;
            }

            const cached = (await cache.tryGet(item.link, async () => {
                try {
                    const detailHtml = await ofetch(item.link);
                    const $d = load(detailHtml);
                    $d('script, style').remove();

                    // Extract article body from text wrapper blocks
                    const bodyParts: string[] = [];
                    $d('div.article-page div.text .text__wrapper').each((_, el) => {
                        const html = $d(el).html()?.trim();
                        if (html && html.length > 50) {
                            bodyParts.push(html);
                        }
                    });

                    // Extract date from data-cmp-data-layer
                    let dateText = '';
                    $d('[data-cmp-data-layer]').each((_, el) => {
                        if (dateText) {
                            return;
                        }
                        try {
                            const dataStr = $d(el).attr('data-cmp-data-layer') || '';
                            const data = JSON.parse(dataStr);
                            const key = Object.keys(data)[0];
                            if (data[key]?.['repo:modifyDate']) {
                                dateText = data[key]['repo:modifyDate'];
                            }
                        } catch {
                            // ignore parse errors
                        }
                    });

                    const description = bodyParts.join('');
                    return JSON.stringify({ description, dateText });
                } catch {
                    return JSON.stringify({ description: '', dateText: '' });
                }
            })) as string;

            const { description, dateText } = JSON.parse(cached);

            return {
                ...item,
                description: description || item.title,
                pubDate: item.pubDate || (dateText ? parseDate(dateText) : undefined),
            } as DataItem;
        })
    );

    return {
        title: 'Abbott - Newsroom',
        link: listUrl,
        description: 'Latest news and press releases from Abbott.',
        item: items,
        language: 'en',
        view: ViewType.Articles,
    };
}
