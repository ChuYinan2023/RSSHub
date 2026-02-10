import { load } from 'cheerio';

import type { Data, DataItem, Route } from '@/types';
import { ViewType } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const baseUrl = 'https://microport.com';

export const route: Route = {
    path: '/news',
    name: 'News',
    url: 'microport.com',
    maintainers: ['ChuYinan2023'],
    handler,
    example: '/microport/news',
    parameters: {},
    description: 'Latest news from MicroPort Scientific.',
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
            source: ['microport.com/news'],
            target: '/news',
        },
    ],
    view: ViewType.Articles,
};

async function handler(): Promise<Data> {
    const listUrl = `${baseUrl}/news`;
    const html = await ofetch(listUrl);
    const $ = load(html);

    const limit = 16;

    const listItems = $('div.card.h-100')
        .toArray()
        .slice(0, limit)
        .map((el) => {
            const $el = $(el);
            const title = $el.find('p.card-title b').text().trim();
            const dateText = $el.find('span.post_date').text().trim();
            const rawHref = $el.find('div.card-footer a.btn__cta').attr('href') || '';
            const link = rawHref.startsWith('http') ? rawHref : `${baseUrl}${rawHref}`;

            return { title, link, dateText };
        })
        .filter((item) => item.title && item.link);

    const items: DataItem[] = await Promise.all(
        listItems.map(async (item) => {
            const description = (await cache.tryGet(item.link, async () => {
                const detailHtml = await ofetch(item.link);
                const $d = load(detailHtml);
                return $d('section.paragraph div.col').html()?.trim() || '';
            })) as string;

            return {
                title: item.title,
                link: item.link,
                description,
                pubDate: item.dateText ? parseDate(item.dateText) : undefined,
            };
        })
    );

    return {
        title: 'MicroPort - News',
        link: listUrl,
        description: 'Latest news from MicroPort Scientific',
        item: items as DataItem[],
        language: 'en',
        view: ViewType.Articles,
    };
}
