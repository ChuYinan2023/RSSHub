import { load } from 'cheerio';

import type { Data, Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const baseUrl = 'https://www.escardio.org';

export const route: Route = {
    path: '/press-releases',
    categories: ['journal'],
    example: '/escardio/press-releases',
    parameters: {},
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['www.escardio.org/news/press/press-releases/'],
            target: '/press-releases',
        },
    ],
    name: 'Press Releases',
    maintainers: ['ChuYinan2023'],
    handler,
    url: 'www.escardio.org/news/press/press-releases/',
};

async function handler(): Promise<Data> {
    const listUrl = `${baseUrl}/news/press/press-releases/`;
    const response = await ofetch(listUrl);
    const $ = load(response);

    const listItems = $('div.resource-card')
        .toArray()
        .map((el) => {
            const $el = $(el);
            const title = $el.find('h4.card-title').text().trim();
            const href = $el.find('a.stretched-link').attr('href') || '';
            const link = href.startsWith('http') ? href : `${baseUrl}${href}`;
            const dateText = $el.find('small').text().trim();
            const pubDate = dateText ? parseDate(dateText) : undefined;

            return { title, link, pubDate };
        })
        .filter((item) => item.title && item.link)
        .slice(0, 20);

    const items = await Promise.all(
        listItems.map((item) =>
            cache.tryGet(item.link, async () => {
                const detailResponse = await ofetch(item.link);
                const $detail = load(detailResponse);

                const description = $detail('article.article-body').html()?.trim() || '';

                return {
                    title: item.title,
                    link: item.link,
                    description,
                    pubDate: item.pubDate,
                };
            })
        )
    );

    return {
        title: 'ESC - Press Releases',
        link: listUrl,
        description: 'Press releases from the European Society of Cardiology',
        item: items as Data['item'],
    };
}
