import { load } from 'cheerio';

import type { Data, DataItem, Route } from '@/types';
import { ViewType } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const baseUrl = 'https://www.sanofi.com';

export const route: Route = {
    path: '/press-releases',
    name: 'Press Releases',
    url: 'www.sanofi.com/en/media-room/press-releases',
    maintainers: ['ChuYinan2023'],
    handler,
    example: '/sanofi/press-releases',
    parameters: {},
    description: 'Latest press releases from Sanofi.',
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
            source: ['www.sanofi.com/en/media-room/press-releases'],
            target: '/press-releases',
        },
    ],
    view: ViewType.Articles,
};

async function handler(): Promise<Data> {
    const listUrl = `${baseUrl}/en/media-room/press-releases`;
    const html = await ofetch(listUrl);
    const $ = load(html);

    // Each press release card has: date (MuiTypography-body2), title (MuiTypography-h3), and link
    const dates = $('div.MuiTypography-body2')
        .toArray()
        .map((el) => $(el).text().trim());
    const titles = $('div.MuiTypography-h3')
        .toArray()
        .map((el) => $(el).text().trim());
    const links = $('a[href^="/en/media-room/press-releases/2"]')
        .toArray()
        .map((el) => $(el).attr('href') || '');

    const count = Math.min(dates.length, titles.length, links.length);

    const listItems = Array.from({ length: count }, (_, i) => ({
        title: titles[i],
        link: `${baseUrl}${links[i]}`,
        pubDate: dates[i] ? parseDate(dates[i]) : undefined,
    }));

    const items: DataItem[] = await Promise.all(
        listItems.map(async (item) => {
            const cached = (await cache.tryGet(item.link, async () => {
                try {
                    const detailHtml = await ofetch(item.link);
                    const $d = load(detailHtml);

                    // Article body is inside <main>, paragraphs and lists with MuiTypography-body1
                    const bodyParts: string[] = [];
                    $d('main')
                        .find('p.MuiTypography-body1, ul.MuiTypography-body1')
                        .each((_, el) => {
                            const h = $d(el).html()?.trim();
                            if (h) {
                                const tag = el.type === 'tag' ? el.tagName : 'p';
                                bodyParts.push(`<${tag}>${h}</${tag}>`);
                            }
                        });

                    return bodyParts.join('\n') || '';
                } catch {
                    return '';
                }
            })) as string;

            return {
                ...item,
                description: cached || item.title,
            } as DataItem;
        })
    );

    return {
        title: 'Sanofi - Press Releases',
        link: listUrl,
        description: 'Latest press releases from Sanofi.',
        item: items,
        language: 'en',
        view: ViewType.Articles,
    };
}
