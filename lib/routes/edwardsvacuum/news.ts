import { load } from 'cheerio';

import type { Data, DataItem, Route } from '@/types';
import { ViewType } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const baseUrl = 'https://www.edwardsvacuum.com';

export const route: Route = {
    path: '/news',
    name: 'News and Events',
    url: 'www.edwardsvacuum.com/en-uk/news-and-events',
    maintainers: ['ChuYinan2023'],
    handler,
    example: '/edwardsvacuum/news',
    parameters: {},
    description: 'Latest news and events from Edwards Vacuum.',
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
            source: ['www.edwardsvacuum.com/en-uk/news-and-events'],
            target: '/news',
        },
    ],
    view: ViewType.Articles,
};

async function handler(): Promise<Data> {
    const listUrl = `${baseUrl}/en-uk/news-and-events`;
    const html = await ofetch(listUrl);
    const $ = load(html);

    const seen = new Set<string>();
    const listItems: Array<{
        title: string;
        link: string;
        pubDate?: ReturnType<typeof parseDate>;
        category: string;
    }> = [];

    $('div.card-captions').each((_, el) => {
        const $el = $(el);
        const $a = $el.parent('a');
        const href = $a.attr('href') || '';
        if (!href || seen.has(href)) {
            return;
        }
        seen.add(href);

        const title = $el.find('div').first().text().trim();
        if (!title) {
            return;
        }

        const link = href.startsWith('http') ? href : `${baseUrl}${href}`;
        const dateText = $el.find('footer span').first().text().trim();
        const category = $el.find('label.category-label').text().trim();
        const pubDate = dateText ? parseDate(dateText) : undefined;

        listItems.push({ title, link, pubDate, category });
    });

    const items: DataItem[] = await Promise.all(
        listItems.slice(0, 20).map(async (item) => {
            const cached = (await cache.tryGet(item.link, async () => {
                try {
                    const detailHtml = await ofetch(item.link);
                    const $d = load(detailHtml);
                    $d('script, style').remove();

                    // Collect all cmp-text blocks except the first (which is meta info)
                    const blocks: string[] = [];
                    $d('div.cmp-text').each((i, el) => {
                        if (i === 0) {
                            return;
                        }
                        const html = $d(el).html()?.trim();
                        if (html) {
                            blocks.push(html);
                        }
                    });

                    return blocks.join('');
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
        title: 'Edwards Vacuum - News and Events',
        link: listUrl,
        description: 'Latest news and events from Edwards Vacuum.',
        item: items,
        language: 'en',
        view: ViewType.Articles,
    };
}
