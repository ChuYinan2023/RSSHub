import { load } from 'cheerio';

import type { Data, DataItem, Route } from '@/types';
import { ViewType } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const baseUrl = 'https://www.prnewswire.com';

const categoryMap: Record<string, { label: string; rssPath: string }> = {
    'medical-equipment': {
        label: 'Medical Equipment',
        rssPath: 'health-latest-news/medical-equipment-list.rss',
    },
    pharmaceuticals: {
        label: 'Pharmaceuticals',
        rssPath: 'health-latest-news/pharmaceuticals-list.rss',
    },
    'fda-approval': {
        label: 'FDA Approval',
        rssPath: 'health-latest-news/fda-approval-list.rss',
    },
    health: {
        label: 'Health',
        rssPath: 'health-latest-news/health-latest-news-list.rss',
    },
};

export const route: Route = {
    path: '/news/:category?',
    name: 'News Releases',
    url: 'www.prnewswire.com',
    maintainers: ['ChuYinan2023'],
    handler,
    example: '/prnewswire/news/medical-equipment',
    parameters: {
        category: {
            description: 'Category slug, see table below. Defaults to medical-equipment.',
            default: 'medical-equipment',
            options: [
                { value: 'medical-equipment', label: 'Medical Equipment' },
                { value: 'pharmaceuticals', label: 'Pharmaceuticals' },
                { value: 'fda-approval', label: 'FDA Approval' },
                { value: 'health', label: 'Health' },
            ],
        },
    },
    description: `| Category | Slug |
| --- | --- |
| Medical Equipment | medical-equipment |
| Pharmaceuticals | pharmaceuticals |
| FDA Approval | fda-approval |
| Health | health |`,
    categories: ['traditional-media'],
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
            source: ['www.prnewswire.com/news-releases/health-latest-news/medical-equipment-list/'],
            target: '/news/medical-equipment',
        },
        {
            source: ['www.prnewswire.com/news-releases/health-latest-news/pharmaceuticals-list/'],
            target: '/news/pharmaceuticals',
        },
        {
            source: ['www.prnewswire.com/news-releases/health-latest-news/fda-approval-list/'],
            target: '/news/fda-approval',
        },
        {
            source: ['www.prnewswire.com/news-releases/health-latest-news/health-latest-news-list/'],
            target: '/news/health',
        },
    ],
    view: ViewType.Articles,
};

async function handler(ctx): Promise<Data> {
    const category = ctx.req.param('category') || 'medical-equipment';
    const limit = Number.parseInt(ctx.req.query('limit') || '20', 10);

    const config = categoryMap[category] || categoryMap['medical-equipment'];
    const feedUrl = `${baseUrl}/rss/${config.rssPath}`;

    const xml = await ofetch(feedUrl, { parseResponse: (txt) => txt });
    const $ = load(xml, { xmlMode: true });

    const items: DataItem[] = $('item')
        .toArray()
        .slice(0, limit)
        .map((el) => {
            const $item = $(el);
            const categories = $item
                .find(String.raw`prn\:industry, industry`)
                .toArray()
                .map((c) => $(c).text().trim())
                .filter(Boolean);

            return {
                title: $item.find('title').text().trim(),
                link: $item.find('link').text().trim(),
                description: $item.find('description').text().trim(),
                pubDate: parseDate($item.find('pubDate').text().trim()),
                author: $item
                    .find(String.raw`dc\:contributor, contributor`)
                    .text()
                    .trim(),
                category: categories.length > 0 ? categories : undefined,
            };
        });

    return {
        title: `PR Newswire - ${config.label}`,
        link: `${baseUrl}/news-releases/health-latest-news/${category}-list/`,
        description: `PR Newswire ${config.label} news releases`,
        item: items,
        language: 'en',
        view: ViewType.Articles,
    };
}
