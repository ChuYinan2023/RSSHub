import { load } from 'cheerio';

import type { Data, DataItem, Route } from '@/types';
import { ViewType } from '@/types';
import { parseDate } from '@/utils/parse-date';
import parser from '@/utils/rss-parser';

const feedUrl = 'https://www.pfizer.com/newsfeed';

export const route: Route = {
    path: '/press-releases',
    name: 'Press Releases',
    url: 'www.pfizer.com',
    maintainers: ['ChuYinan2023'],
    handler,
    example: '/pfizer/press-releases',
    parameters: {},
    description: 'Latest press releases from Pfizer newsroom.',
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
            source: ['www.pfizer.com/newsroom/press-releases'],
            target: '/press-releases',
        },
    ],
    view: ViewType.Articles,
};

async function handler(): Promise<Data> {
    const feed = await parser.parseURL(feedUrl);

    const items: DataItem[] = feed.items.map((item) => {
        const $desc = load(item.content || item['content:encoded'] || item.description || '');

        const datetime = $desc('time[datetime]').attr('datetime');
        const body = $desc('div.article-body').html()?.trim() || $desc('div.article-content').html()?.trim() || item.description || '';

        const categories: string[] = [];
        $desc('li.field_tags a, li.field_media_asset_category a').each((_, el) => {
            const tag = $desc(el).text().trim();
            if (tag) {
                categories.push(tag);
            }
        });

        return {
            title: item.title || '',
            link: item.link || '',
            description: body,
            pubDate: datetime ? parseDate(datetime) : undefined,
            category: categories.length > 0 ? categories : undefined,
        };
    });

    return {
        title: 'Pfizer - Press Releases',
        link: 'https://www.pfizer.com/newsroom/press-releases',
        description: 'Latest press releases from Pfizer',
        item: items,
        language: 'en',
        view: ViewType.Articles,
    };
}
