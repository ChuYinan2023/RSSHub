import { load } from 'cheerio';

import type { Data, Route } from '@/types';
import ofetch from '@/utils/ofetch';

const baseUrl = 'https://cardiovascularbusiness.com';

export const route: Route = {
    path: '/news',
    categories: ['new-media'],
    example: '/cardiovascularbusiness/news',
    parameters: {},
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: true,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [{ source: ['cardiovascularbusiness.com/news'], target: '/news' }],
    name: 'News',
    maintainers: ['ChuYinan2023'],
    handler,
    url: 'cardiovascularbusiness.com/news',
};

async function handler(): Promise<Data> {
    const listUrl = `${baseUrl}/news`;
    const response = await ofetch(listUrl, {
        headerGeneratorOptions: {
            browsers: [{ name: 'chrome', minVersion: 120 }],
            operatingSystems: ['windows'],
            devices: ['desktop'],
        },
    });
    const $ = load(response);

    const items = $('div.views-col')
        .toArray()
        .map((el) => {
            const $el = $(el);
            const $titleLink = $el.find('.views-field-title a');
            const title = $titleLink.text().trim();
            const rawHref = $titleLink.attr('href') || '';
            const link = rawHref.startsWith('http') ? rawHref : `${baseUrl}${rawHref}`;
            const description = $el.find('.views-field-field-teaser-text-new .field-content').html()?.trim() || '';
            const image = $el.find('.views-field-field-teaser-media img').attr('src');
            const fullImage = image && !image.startsWith('http') ? `${baseUrl}${image}` : image;
            return { title, link, description, image: fullImage };
        })
        .filter((item) => item.title && item.link);

    return {
        title: 'Cardiovascular Business - News',
        link: listUrl,
        description: 'Latest cardiovascular news for healthcare professionals',
        item: items as Data['item'],
    };
}
