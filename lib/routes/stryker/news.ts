import { load } from 'cheerio';

import type { Data, DataItem, Route } from '@/types';
import { ViewType } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const baseUrl = 'https://www.stryker.com';

export const route: Route = {
    path: '/news',
    name: 'News',
    url: 'www.stryker.com/us/en/about/news',
    maintainers: ['ChuYinan2023'],
    handler,
    example: '/stryker/news',
    parameters: {},
    description: 'Latest news from Stryker.',
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
            source: ['www.stryker.com/us/en/about/news.html', 'www.stryker.com/us/en/about/news/index.html'],
            target: '/news',
        },
    ],
    view: ViewType.Articles,
};

async function handler(): Promise<Data> {
    const listUrl = `${baseUrl}/us/en/about/news.html`;
    const html = await ofetch(listUrl);
    const $ = load(html);

    // All news items (visible + hidden) are in the SSR HTML
    const listItems = $('div.news')
        .toArray()
        .slice(0, 20)
        .map((el) => {
            const $el = $(el);
            const dateText = $el.find('h5').first().text().trim();
            const title = $el.find('h2').first().text().trim();
            const excerpt = $el.find('p').first().text().trim();
            const href = $el.find('a.action-link').attr('href') || '';
            const link = href.startsWith('http') ? href : `${baseUrl}${href}`;

            return {
                title,
                link,
                pubDate: dateText ? parseDate(dateText) : undefined,
                description: excerpt,
            };
        })
        .filter((item) => item.title && item.link);

    const items: DataItem[] = await Promise.all(
        listItems.map(async (item) => {
            const cached = (await cache.tryGet(item.link, async () => {
                try {
                    const detailHtml = await ofetch(item.link);
                    const $d = load(detailHtml);

                    return $d('div.c-rich-text-editor').first().html()?.trim() || '';
                } catch {
                    return '';
                }
            })) as string;

            return {
                ...item,
                description: cached || item.description,
            } as DataItem;
        })
    );

    return {
        title: 'Stryker - News',
        link: `${baseUrl}/us/en/about/news`,
        description: 'Latest news from Stryker.',
        item: items,
        language: 'en',
        view: ViewType.Articles,
    };
}
