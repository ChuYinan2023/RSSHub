import { load } from 'cheerio';

import { config } from '@/config';
import type { Data, Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/latest-news',
    categories: ['journal'],
    example: '/medscape/latest-news',
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
            source: ['www.medscape.com/index/list_13470_0'],
            target: '/latest-news',
        },
    ],
    name: 'Latest News',
    maintainers: ['ChuYinan2023'],
    handler,
    url: 'www.medscape.com/index/list_13470_0',
};

async function handler(): Promise<Data> {
    const listUrl = 'https://www.medscape.com/index/list_13470_0';
    const response = await ofetch(listUrl, {
        headers: {
            'User-Agent': config.trueUA,
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
        },
    });
    const $ = load(response);

    const items = $('#archives ul > li')
        .toArray()
        .map((el) => {
            const $el = $(el);
            const $link = $el.find('a.title');
            const title = $link.text().trim();
            const rawHref = $link.attr('href') || '';
            const link = rawHref.startsWith('//') ? `https:${rawHref}` : rawHref;
            const teaser = $el.find('span.teaser').text().trim();
            const byline = $el.find('div.byline').text().trim();

            // Parse date from byline like "Medscape Medical News, February 09, 2026"
            const dateMatch = byline.match(/,\s*(\w+ \d{1,2},\s*\d{4})/);
            const pubDate = dateMatch ? parseDate(dateMatch[1]) : undefined;

            // Extract source from byline (before the date)
            const sourceMatch = byline.match(/^(.+?),\s*\w+ \d{1,2}/);
            const source = sourceMatch ? sourceMatch[1].trim() : undefined;

            return {
                title,
                link,
                description: teaser,
                pubDate,
                author: source,
            };
        })
        .filter((item) => item.title && item.link);

    return {
        title: 'Medscape - Latest News',
        link: listUrl,
        description: 'Latest medical news from Medscape',
        item: items,
    };
}
