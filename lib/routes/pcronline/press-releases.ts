import { load } from 'cheerio';

import type { Data, Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const baseUrl = 'https://www.pcronline.com';

export const route: Route = {
    path: '/press-releases',
    categories: ['journal'],
    example: '/pcronline/press-releases',
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
            source: ['www.pcronline.com/News/Press-releases'],
            target: '/press-releases',
        },
    ],
    name: 'Press Releases',
    maintainers: ['ChuYinan2023'],
    handler,
    url: 'www.pcronline.com/News/Press-releases',
};

async function handler(): Promise<Data> {
    const listUrl = `${baseUrl}/News/Press-releases`;
    const response = await ofetch(listUrl);
    const $ = load(response);

    const listItems = $('a.list-result-item')
        .toArray()
        .map((el) => {
            const $el = $(el);
            const title = $el.find('p.list-result-txt').text().trim();
            const rawHref = $el.attr('href') || '';
            const link = rawHref.startsWith('http') ? rawHref : `${baseUrl}${rawHref}`;
            const dateText = $el.find('p.event-date').text().trim();
            const pubDate = dateText ? parseDate(dateText) : undefined;

            return { title, link, pubDate };
        })
        .filter((item) => item.title && item.link);

    const items = await Promise.all(
        listItems.map((item) =>
            cache.tryGet(item.link, async () => {
                const detailResponse = await ofetch(item.link);
                const $detail = load(detailResponse);

                // Extract main article content from .edito container
                const $edito = $detail('.edito');

                // Remove disclaimer footer if present
                $edito.find('p:last-child').each((_, el) => {
                    const text = $detail(el).text();
                    if (text.includes('does not reflect the opinion of PCR')) {
                        $detail(el).remove();
                    }
                });

                const description = $edito.html()?.trim() || '';

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
        title: 'PCRonline - Press Releases',
        link: listUrl,
        description: 'Industry press releases from PCRonline on interventional cardiology',
        item: items as Data['item'],
    };
}
