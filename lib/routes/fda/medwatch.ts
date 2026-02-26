import { load } from 'cheerio';

import type { Data, DataItem, Route } from '@/types';
import { ViewType } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const feedUrl = 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/medwatch/rss.xml';

export const route: Route = {
    path: '/medwatch',
    name: 'MedWatch Safety Alerts',
    url: 'www.fda.gov/safety/medwatch-fda-safety-information-and-adverse-event-reporting-program',
    maintainers: ['ChuYinan2023'],
    handler,
    example: '/fda/medwatch',
    description: 'FDA MedWatch safety alerts for medical device recalls and early alerts.',
    categories: ['government'],
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
            source: ['www.fda.gov/safety/medwatch-fda-safety-information-and-adverse-event-reporting-program'],
            target: '/medwatch',
        },
        {
            source: ['www.fda.gov/medical-devices/medical-device-recalls-and-early-alerts'],
            target: '/medwatch',
        },
    ],
    view: ViewType.Articles,
};

async function handler(ctx): Promise<Data> {
    const limit = Number.parseInt(ctx.req.query('limit') || '20', 10);

    const xml = await ofetch(feedUrl, { parseResponse: (txt) => txt });
    const $ = load(xml, { xmlMode: true });

    const items: DataItem[] = $('item')
        .toArray()
        .slice(0, limit)
        .map((el) => {
            const $item = $(el);
            const link = $item.find('link').text().trim();

            return {
                title: $item.find('title').text().trim(),
                link: link.startsWith('http://') ? link.replace('http://', 'https://') : link,
                description: $item.find('description').text().trim(),
                pubDate: parseDate($item.find('pubDate').text().trim()),
                author:
                    $item
                        .find(String.raw`dc\:creator, creator`)
                        .text()
                        .trim() || 'FDA',
            };
        });

    return {
        title: 'FDA MedWatch Safety Alerts',
        link: 'https://www.fda.gov/safety/medwatch-fda-safety-information-and-adverse-event-reporting-program',
        description: 'FDA MedWatch safety alerts for medical device recalls, early alerts, and adverse event reports.',
        item: items,
        language: 'en',
        view: ViewType.Articles,
    };
}
