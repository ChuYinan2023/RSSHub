import { load } from 'cheerio';

import type { Data, DataItem, Route } from '@/types';
import { ViewType } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const baseUrl = 'https://www.usa.philips.com';

export const route: Route = {
    path: '/news',
    name: 'News',
    url: 'www.usa.philips.com/a-w/about/news/home',
    maintainers: ['ChuYinan2023'],
    handler,
    example: '/philips/news',
    parameters: {},
    description: 'Latest news and press releases from Philips.',
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
            source: ['www.usa.philips.com/a-w/about/news/home'],
            target: '/news',
        },
    ],
    view: ViewType.Articles,
};

async function handler(): Promise<Data> {
    const listUrl = `${baseUrl}/a-w/about/news/home`;
    const html = await ofetch(listUrl);
    const $ = load(html);

    const listItems = $('div.p-rn45__card')
        .toArray()
        .map((el) => {
            const $el = $(el);
            const $link = $el.find('a.p-rn45__link');
            const title = $link.attr('title')?.trim() || $link.text().trim();
            const href = $link.attr('href') || '';
            const link = href.startsWith('http') ? href : `${baseUrl}${href}`;

            // Date text format: "Press release | January 16, 2026"
            const dateRaw = $el.find('p.p-rn45__date').text().trim();
            const dateParts = dateRaw.split('|');
            const category = dateParts[0]?.trim() || '';
            const dateText = dateParts[1]?.trim() || '';

            return {
                title,
                link,
                pubDate: dateText ? parseDate(dateText) : undefined,
                category: category ? [category] : undefined,
            };
        });

    const items: DataItem[] = await Promise.all(
        listItems.map(async (item) => {
            const cached = (await cache.tryGet(item.link, async () => {
                try {
                    const detailHtml = await ofetch(item.link);
                    const $d = load(detailHtml);

                    const bodyParts: string[] = [];
                    $d('p.p-body-text').each((_, el) => {
                        const text = $d(el).html()?.trim();
                        if (text && text.length > 20) {
                            bodyParts.push(`<p>${text}</p>`);
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
        title: 'Philips - News',
        link: listUrl,
        description: 'Latest news and press releases from Philips.',
        item: items,
        language: 'en',
        view: ViewType.Articles,
    };
}
