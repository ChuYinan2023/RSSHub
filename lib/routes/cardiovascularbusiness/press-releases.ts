import { load } from 'cheerio';

import type { Data, Route } from '@/types';
import { getPuppeteerPage } from '@/utils/puppeteer';

const baseUrl = 'https://cardiovascularbusiness.com';

export const route: Route = {
    path: '/press-releases',
    categories: ['new-media'],
    example: '/cardiovascularbusiness/press-releases',
    parameters: {},
    features: {
        requireConfig: false,
        requirePuppeteer: true,
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

async function handler(): Promise<Data> {
    const listUrl = `${baseUrl}/resources/press-releases`;

    const { page, destory } = await getPuppeteerPage(listUrl, {
        onBeforeLoad: async (page) => {
            await page.setRequestInterception(true);
            page.on('request', (request) => {
                request.resourceType() === 'document' ? request.continue() : request.abort();
            });
        },
    });

    await page.waitForSelector('.views-row');
    const html = await page.evaluate(() => document.documentElement.innerHTML);
    await page.close();
    await destory();

    const $ = load(html);

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
