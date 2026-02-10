import { load } from 'cheerio';

import type { Data, DataItem, Route } from '@/types';
import { ViewType } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const baseUrl = 'https://news.medtronic.com';

export const route: Route = {
    path: '/press-releases',
    name: 'Press Releases',
    url: 'news.medtronic.com',
    maintainers: ['ChuYinan2023'],
    handler,
    example: '/medtronic/press-releases',
    parameters: {},
    description: 'Latest press releases from Medtronic newsroom.',
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
            source: ['news.medtronic.com/press-releases'],
            target: '/press-releases',
        },
    ],
    view: ViewType.Articles,
};

async function handler(): Promise<Data> {
    const listUrl = `${baseUrl}/press-releases`;
    const html = await ofetch(listUrl);
    const $ = load(html);

    const limit = 20;

    const listItems = $('div.wd_title')
        .toArray()
        .slice(0, limit)
        .map((el) => {
            const $el = $(el);
            const $a = $el.find('a');
            const title = $a.text().trim();
            const rawHref = $a.attr('href') || '';
            const link = rawHref.startsWith('http') ? rawHref : `${baseUrl}${rawHref}`;
            return { title, link };
        })
        .filter((item) => item.title && item.link);

    const items: DataItem[] = await Promise.all(
        listItems.map(async (item) => {
            const cached = (await cache.tryGet(item.link, async () => {
                const detailHtml = await ofetch(item.link);
                const $d = load(detailHtml);

                const description = $d('div.wd_body.wd_news_body').html()?.trim() || '';
                const dateText = $d('div.wd_date').first().text().trim();

                return JSON.stringify({ description, dateText });
            })) as string;

            const { description, dateText } = JSON.parse(cached);

            return {
                title: item.title,
                link: item.link,
                description,
                pubDate: dateText ? parseDate(dateText) : undefined,
            };
        })
    );

    return {
        title: 'Medtronic - Press Releases',
        link: listUrl,
        description: 'Latest press releases from Medtronic',
        item: items as DataItem[],
        language: 'en',
        view: ViewType.Articles,
    };
}
