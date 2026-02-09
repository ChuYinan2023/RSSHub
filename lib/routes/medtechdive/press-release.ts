import { load } from 'cheerio';

import type { Data, Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const baseUrl = 'https://www.medtechdive.com';

export const route: Route = {
    path: '/press-release',
    categories: ['new-media'],
    example: '/medtechdive/press-release',
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
            source: ['www.medtechdive.com/press-release/'],
            target: '/press-release',
        },
    ],
    name: 'Press Releases',
    maintainers: ['ChuYinan2023'],
    handler,
    url: 'www.medtechdive.com/press-release/',
};

async function handler(): Promise<Data> {
    const listUrl = `${baseUrl}/press-release/`;
    const response = await ofetch(listUrl);
    const $ = load(response);

    const listItems = $('li.feed__item')
        .toArray()
        .map((el) => {
            const $el = $(el);
            const $link = $el.find('h3.feed__title a');
            const title = $link.text().trim();
            const rawHref = $link.attr('href') || '';
            const link = rawHref.startsWith('http') ? rawHref : `${baseUrl}${rawHref}`;
            const label = $el.find('span.secondary-label').text().trim();

            // Parse date from label like "Press release from Proscia • Feb. 5, 2026"
            const dateMatch = label.match(/•\s*(.+)$/);
            const pubDate = dateMatch ? parseDate(dateMatch[1].trim()) : undefined;

            // Extract company name from label
            const companyMatch = label.match(/from\s+(.+?)\s*•/);
            const author = companyMatch ? companyMatch[1].trim() : undefined;

            // Extract company logo
            const image = $el.find('.pressrelease-logo-container img').attr('src');

            return { title, link, pubDate, author, image };
        })
        .filter((item) => item.title && item.link);

    const items = await Promise.all(
        listItems.map((item) =>
            cache.tryGet(item.link, async () => {
                const detailResponse = await ofetch(item.link);
                const $detail = load(detailResponse);

                const description = $detail('.content__text').html()?.trim() || '';

                return {
                    title: item.title,
                    link: item.link,
                    description,
                    pubDate: item.pubDate,
                    author: item.author,
                    image: item.image,
                };
            })
        )
    );

    return {
        title: 'MedTech Dive - Press Releases',
        link: listUrl,
        description: 'Medical technology press releases from MedTech Dive',
        item: items as Data['item'],
    };
}
