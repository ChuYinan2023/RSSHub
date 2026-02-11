import { load } from 'cheerio';

import { config } from '@/config';
import type { Data, DataItem, Route } from '@/types';
import { ViewType } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const baseUrl = 'https://www.scai.org';

const headers = {
    'user-agent': config.trueUA,
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'accept-language': 'en-US,en;q=0.9',
};

export const route: Route = {
    path: '/events',
    name: 'Events Schedule',
    url: 'www.scai.org/education-and-events/events-schedule',
    maintainers: ['ChuYinan2023'],
    handler,
    example: '/scai/events',
    parameters: {},
    description: 'Upcoming events and conferences from SCAI.',
    categories: ['other'],
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: true,
        supportRadar: true,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['www.scai.org/education-and-events/events-schedule'],
            target: '/events',
        },
    ],
    view: ViewType.Articles,
};

function cleanDate(dateText: string): string {
    // Remove ordinal suffixes and range part: "Feb 14th - 15th, 2026" → "Feb 14, 2026"
    return dateText.replaceAll(/(\d+)(st|nd|rd|th)/g, '$1').replace(/\s*-\s*\d+,/, ',');
}

async function handler(): Promise<Data> {
    const listUrl = `${baseUrl}/education-and-events/events-schedule`;
    const html = await ofetch(listUrl, { headers });
    const $ = load(html);

    const listItems: Array<{
        title: string;
        link: string;
        pubDate?: ReturnType<typeof parseDate>;
        category: string;
        summary: string;
    }> = [];

    $('.listing-item').each((_, el) => {
        const $el = $(el);
        const title = $el.find('.listing-item__title').text().trim();
        if (!title) {
            return;
        }

        const href = $el.find('.listing-item__link').attr('href') || '';
        if (!href) {
            return;
        }

        const link = href.startsWith('http') ? href : `${baseUrl}${href}`;
        const dateText = $el.find('.listing-item__date').text().trim();
        const category = $el.find('.listing-item__type').text().trim();
        const summary = $el.find('.listing-item__summary').text().trim();
        const cleaned = dateText ? cleanDate(dateText) : '';
        const pubDate = cleaned ? parseDate(cleaned) : undefined;

        listItems.push({ title, link, pubDate, category, summary });
    });

    const items: DataItem[] = await Promise.all(
        listItems.slice(0, 20).map(async (item) => {
            const cached = (await cache.tryGet(item.link, async () => {
                try {
                    const detailHtml = await ofetch(item.link, { headers });
                    const $d = load(detailHtml);
                    $d('script, style').remove();

                    const body = $d('div.field--name-field-body-content').first().html()?.trim();
                    return body || '';
                } catch {
                    return '';
                }
            })) as string;

            return {
                title: item.title,
                link: item.link,
                pubDate: item.pubDate,
                category: item.category ? [item.category] : undefined,
                description: cached || item.summary || item.title,
            } as DataItem;
        })
    );

    return {
        title: 'SCAI - Events Schedule',
        link: listUrl,
        description: 'Upcoming events and conferences from SCAI.',
        item: items,
        language: 'en',
        view: ViewType.Articles,
    };
}
