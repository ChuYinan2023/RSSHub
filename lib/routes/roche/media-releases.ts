import { load } from 'cheerio';
import type { Context } from 'hono';

import type { Data, DataItem, Route } from '@/types';
import { ViewType } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const baseUrl = 'https://www.roche.com';
const apiBase = 'https://api-prod.roche.com/externaldatasources/news';

interface RocheNewsItem {
    Title: { en: string };
    ReleaseDateTime: string;
    Year: string;
    Slug: string;
    Category: string;
    ReleaseDate: string;
}

interface RocheNewsResponse {
    Items: RocheNewsItem[];
    Total: number;
    Page: number;
}

const fetchPage = async (year: number, page: number): Promise<RocheNewsResponse> => await ofetch(`${apiBase}?category=media&year=${year}&page=${page}`);

const fetchDetailContent = (link: string) =>
    cache.tryGet(link, async () => {
        const html = await ofetch(link);
        const $ = load(html);

        const content = $('div.rich-text#content-left').html()?.trim() || '';

        return content;
    });

export const handler = async (ctx: Context): Promise<Data> => {
    const limit = Number.parseInt(ctx.req.query('limit') ?? '20', 10);
    const yearParam = ctx.req.param('year');

    const currentYear = new Date().getFullYear();
    const year = yearParam ? Number.parseInt(yearParam, 10) : currentYear;

    let allItems: RocheNewsItem[] = [];

    // Fetch first page of specified year
    const firstPage = await fetchPage(year, 1);
    allItems.push(...firstPage.Items);

    // If we need more items and have more pages, fetch page 2
    if (allItems.length < limit && firstPage.Total > 10) {
        const secondPage = await fetchPage(year, 2);
        allItems.push(...secondPage.Items);
    }

    // If still not enough and using current year, also fetch previous year
    if (allItems.length < limit && !yearParam) {
        const prevPage = await fetchPage(currentYear - 1, 1);
        allItems.push(...prevPage.Items);
    }

    allItems = allItems.slice(0, limit);

    const items: DataItem[] = await Promise.all(
        allItems.map(async (entry) => {
            const link = `${baseUrl}/media/releases/${entry.Slug}`;
            const description = await fetchDetailContent(link);

            return {
                title: entry.Title.en,
                link,
                pubDate: parseDate(entry.ReleaseDateTime),
                description: description as string,
            };
        })
    );

    return {
        title: `Roche - Media Releases${yearParam ? ` (${year})` : ''}`,
        link: `${baseUrl}/media/releases`,
        description: 'Latest media releases from Roche',
        item: items,
        language: 'en',
        view: ViewType.Articles,
    };
};

export const route: Route = {
    path: '/media/releases/:year?',
    name: 'Media Releases',
    url: 'www.roche.com',
    maintainers: ['ChuYinan2023'],
    handler,
    example: '/roche/media/releases',
    parameters: {
        year: 'Year of releases, e.g. `2025`. Defaults to current year.',
    },
    description: 'Subscribe to Roche media releases for latest press releases and announcements.',
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
            source: ['www.roche.com/media/releases'],
            target: '/media/releases',
        },
    ],
    view: ViewType.Articles,
};
