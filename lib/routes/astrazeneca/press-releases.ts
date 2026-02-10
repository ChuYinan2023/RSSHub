import { load } from 'cheerio';

import type { Data, DataItem, Route } from '@/types';
import { ViewType } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const baseUrl = 'https://www.astrazeneca.com';
const apiUrl = `${baseUrl}/content/astraz/media-centre/press-releases/_jcr_content/par/filternew.data.json`;

interface AZPressItem {
    link: string;
    title: string;
    dateTime: string;
    date: string;
    tag: Array<{ id: string; title: string }>;
}

function buildLink(rawLink: string): string {
    return `${baseUrl}${rawLink.replace('/content/astraz/', '/')}`;
}

export const route: Route = {
    path: '/press-releases',
    name: 'Press Releases',
    url: 'www.astrazeneca.com',
    maintainers: ['ChuYinan2023'],
    handler,
    example: '/astrazeneca/press-releases',
    parameters: {},
    description: 'Latest press releases from AstraZeneca.',
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
            source: ['www.astrazeneca.com/media-centre/press-releases.html'],
            target: '/press-releases',
        },
    ],
    view: ViewType.Articles,
};

async function handler(ctx): Promise<Data> {
    const limit = Number.parseInt(ctx.req.query('limit') ?? '20', 10);
    const fetchOptions = {
        headerGeneratorOptions: {
            browsers: [{ name: 'chrome', minVersion: 120 }],
            operatingSystems: ['windows'],
            devices: ['desktop'],
        },
    };

    const allItems: AZPressItem[] = await ofetch(apiUrl, fetchOptions);
    const selected = allItems.slice(0, limit);

    const items: DataItem[] = await Promise.all(
        selected.map(async (entry) => {
            const link = buildLink(entry.link);

            const description = (await cache.tryGet(link, async () => {
                const html = await ofetch(link, fetchOptions);
                const $ = load(html);
                return $('div[itemprop="articleBody"] .par.parsys').html()?.trim() || $('div.pt-article__body').html()?.trim() || '';
            })) as string;

            const categories = [...new Set(entry.tag.map((t) => t.title))];

            return {
                title: entry.title,
                link,
                description,
                pubDate: parseDate(entry.dateTime),
                category: categories.length > 0 ? categories : undefined,
            };
        })
    );

    return {
        title: 'AstraZeneca - Press Releases',
        link: `${baseUrl}/media-centre/press-releases.html`,
        description: 'Latest press releases from AstraZeneca',
        item: items,
        language: 'en',
        view: ViewType.Articles,
    };
}
