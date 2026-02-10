import { execSync } from 'node:child_process';

import { load } from 'cheerio';

import type { Data, Route } from '@/types';

const baseUrl = 'https://cardiovascularbusiness.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export const route: Route = {
    path: '/press-releases',
    categories: ['new-media'],
    example: '/cardiovascularbusiness/press-releases',
    parameters: {},
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: true,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [{ source: ['cardiovascularbusiness.com/resources/press-releases'], target: '/press-releases' }],
    name: 'Press Releases',
    maintainers: ['ChuYinan2023'],
    handler,
    url: 'cardiovascularbusiness.com/resources/press-releases',
};

function handler(): Data {
    const listUrl = `${baseUrl}/resources/press-releases`;
    const response = execSync(`curl -s "${listUrl}" -A "${UA}" -H "Accept: text/html"`, {
        encoding: 'utf-8',
        maxBuffer: 2 * 1024 * 1024,
        timeout: 30000,
    });
    const $ = load(response);

    const items = $('div.views-row')
        .toArray()
        .slice(0, 20)
        .map((el) => {
            const $el = $(el);
            const $titleLink = $el.find('.views-field-title a');
            const title = $titleLink.text().trim();
            const rawHref = $titleLink.attr('href') || '';
            const link = rawHref.startsWith('http') ? rawHref : `${baseUrl}${rawHref}`;
            const description = $el.find('.views-field-field-teaser-text-new .field-content').html()?.trim() || '';
            const author = $el.find('.views-field-field-sponsored-by-companies .field-content').text().trim() || undefined;
            return { title, link, description, author };
        })
        .filter((item) => item.title && item.link);

    return {
        title: 'Cardiovascular Business - Press Releases',
        link: listUrl,
        description: 'Press releases from the cardiovascular industry',
        item: items as Data['item'],
    };
}
