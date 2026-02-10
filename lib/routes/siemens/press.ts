import { load } from 'cheerio';

import type { Data, DataItem, Route } from '@/types';
import { ViewType } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const baseUrl = 'https://press.siemens.com';

export const route: Route = {
    path: '/press/:region?/:language?',
    name: 'Press Releases',
    url: 'press.siemens.com',
    maintainers: ['ChuYinan2023'],
    handler,
    example: '/siemens/press/global/en',
    parameters: {
        region: 'Region, e.g. `global`, `de`, `us`. Defaults to `global`.',
        language: 'Language, e.g. `en`, `de`, `ja`. Defaults to `en`.',
    },
    description: 'Latest press releases from Siemens.',
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
            source: ['press.siemens.com/global/en'],
            target: '/press/global/en',
        },
    ],
    view: ViewType.Articles,
};

async function handler(ctx): Promise<Data> {
    const region = ctx.req.param('region') || 'global';
    const language = ctx.req.param('language') || 'en';
    const searchUrl = `${baseUrl}/${region}/${language}/press-search?f[0]=content_type:c2_ct_press_release`;
    const html = await ofetch(searchUrl);
    const $ = load(html);

    const limit = 20;

    const listItems = $('div.press-search-results-view-row')
        .toArray()
        .slice(0, limit)
        .map((el) => {
            const $el = $(el);
            const $a = $el.find('div.views-field-title a');
            const title = $a.text().trim();
            const rawHref = $a.attr('href') || '';
            const link = rawHref.startsWith('http') ? rawHref : `${baseUrl}${rawHref}`;
            const teaser = $el.find('div.views-field-field-press-teaser').text().trim();
            const $time = $el.find('time[datetime]');
            const datetime = $time.attr('datetime');

            return { title, link, teaser, datetime };
        })
        .filter((item) => item.title && item.link);

    const items: DataItem[] = await Promise.all(
        listItems.map(async (item) => {
            const description = (await cache.tryGet(item.link, async () => {
                const detailHtml = await ofetch(item.link);
                const $d = load(detailHtml);

                return $d('div.field--name-field-c2-ct-press-release-body').html()?.trim() || $d('div.field--name-field-c2-ct-press-feature-body').html()?.trim() || item.teaser;
            })) as string;

            return {
                title: item.title,
                link: item.link,
                description,
                pubDate: item.datetime ? parseDate(item.datetime) : undefined,
            };
        })
    );

    return {
        title: `Siemens Press - ${region.charAt(0).toUpperCase() + region.slice(1)} (${language.toUpperCase()})`,
        link: searchUrl,
        description: 'Latest press releases from Siemens',
        item: items as DataItem[],
        language,
        view: ViewType.Articles,
    };
}
