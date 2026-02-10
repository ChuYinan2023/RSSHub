import { load } from 'cheerio';

import type { Data, DataItem, Route } from '@/types';
import { ViewType } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const feedUrl = 'https://investor.lilly.com/rss/news-releases.xml';
const baseUrl = 'https://investor.lilly.com';

export const route: Route = {
    path: '/press-releases',
    name: 'Press Releases',
    url: 'investor.lilly.com',
    maintainers: ['ChuYinan2023'],
    handler,
    example: '/lilly/press-releases',
    parameters: {},
    description: 'Latest press releases from Eli Lilly.',
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
            source: ['www.lilly.com/news/press-releases', 'investor.lilly.com/news-releases'],
            target: '/press-releases',
        },
    ],
    view: ViewType.Articles,
};

async function handler(): Promise<Data> {
    const rssXml = await ofetch(feedUrl, { parseResponse: (txt) => txt });
    const $rss = load(rssXml, { xml: true });

    const items: DataItem[] = $rss('item')
        .toArray()
        .map((el) => {
            const title = $rss(el).find('title').text().trim();
            const link = $rss(el).find('link').text().trim();
            const pubDate = $rss(el).find('pubDate').text().trim();
            const description = $rss(el).find('description').text().trim();

            return {
                title,
                link,
                description,
                pubDate: pubDate ? parseDate(pubDate) : undefined,
            };
        });

    return {
        title: 'Eli Lilly - Press Releases',
        link: `${baseUrl}/news-releases`,
        description: 'Latest press releases from Eli Lilly and Company',
        item: items,
        language: 'en',
        view: ViewType.Articles,
    };
}
