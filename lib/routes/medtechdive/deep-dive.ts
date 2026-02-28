import { load } from 'cheerio';

import type { Data, Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const baseUrl = 'https://www.medtechdive.com';

export const route: Route = {
    path: '/deep-dive',
    categories: ['new-media'],
    example: '/medtechdive/deep-dive',
    parameters: {},
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: true,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['www.medtechdive.com/deep-dive/'],
            target: '/deep-dive',
        },
    ],
    name: 'Deep Dive',
    maintainers: ['ChuYinan2023'],
    handler,
    url: 'www.medtechdive.com/deep-dive/',
};

async function handler(): Promise<Data> {
    const listUrl = `${baseUrl}/deep-dive/`;
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

            // Parse date from label like "Author Name • Feb. 5, 2026"
            const dateMatch = label.match(/•\s*(.+)$/);
            const pubDate = dateMatch ? parseDate(dateMatch[1].trim()) : undefined;

            // Extract author from label before the bullet
            const authorMatch = label.match(/^(.+?)\s*•/);
            const author = authorMatch ? authorMatch[1].replace(/^By\s+/i, '').trim() : undefined;

            return { title, link, pubDate, author };
        })
        .filter((item) => item.title && item.link);

    const items = await Promise.all(
        listItems.map((item) =>
            cache.tryGet(item.link, async () => {
                const detailResponse = await ofetch(item.link);
                const $detail = load(detailResponse);

                const description = $detail('.content__text').html()?.trim() || '';
                const tags = $detail('a.tag')
                    .toArray()
                    .map((el) => $detail(el).text().trim())
                    .filter(Boolean);

                return {
                    title: item.title,
                    link: item.link,
                    description,
                    pubDate: item.pubDate,
                    author: item.author,
                    category: tags,
                };
            })
        )
    );

    return {
        title: 'MedTech Dive - Deep Dive',
        link: listUrl,
        description: 'In-depth analysis and investigative reports from MedTech Dive',
        item: items as Data['item'],
    };
}
