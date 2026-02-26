import { load } from 'cheerio';

import type { Data, DataItem, Route } from '@/types';
import { ViewType } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const baseUrl = 'https://www.globenewswire.com';

const industryMap: Record<string, { code: string; label: string }> = {
    'medical-equipment': {
        code: '4535-Medical Equipment',
        label: 'Medical Equipment',
    },
    'medical-supplies': {
        code: '4537-Medical Supplies',
        label: 'Medical Supplies',
    },
    'health-care': { code: '4000-Health Care', label: 'Health Care' },
    'health-care-providers': {
        code: '4533-Health Care Providers',
        label: 'Health Care Providers',
    },
    biotechnology: { code: '4573-Biotechnology', label: 'Biotechnology' },
    pharmaceuticals: { code: '4577-Pharmaceuticals', label: 'Pharmaceuticals' },
};

export const route: Route = {
    path: '/industry/:industry?',
    name: 'Industry News',
    url: 'www.globenewswire.com',
    maintainers: ['ChuYinan2023'],
    handler,
    example: '/globenewswire/industry/medical-equipment',
    parameters: {
        industry: {
            description: 'Industry slug, see table below. Defaults to medical-equipment.',
            default: 'medical-equipment',
            options: [
                { value: 'medical-equipment', label: 'Medical Equipment' },
                { value: 'medical-supplies', label: 'Medical Supplies' },
                { value: 'health-care', label: 'Health Care' },
                {
                    value: 'health-care-providers',
                    label: 'Health Care Providers',
                },
                { value: 'biotechnology', label: 'Biotechnology' },
                { value: 'pharmaceuticals', label: 'Pharmaceuticals' },
            ],
        },
    },
    description: `| Industry | Slug |
| --- | --- |
| Medical Equipment | medical-equipment |
| Medical Supplies | medical-supplies |
| Health Care | health-care |
| Health Care Providers | health-care-providers |
| Biotechnology | biotechnology |
| Pharmaceuticals | pharmaceuticals |`,
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
            source: ['www.globenewswire.com/rss/list'],
            target: '/industry/medical-equipment',
        },
    ],
    view: ViewType.Articles,
};

async function handler(ctx): Promise<Data> {
    const industry = ctx.req.param('industry') || 'medical-equipment';
    const limit = Number.parseInt(ctx.req.query('limit') || '20', 10);

    const config = industryMap[industry] || industryMap['medical-equipment'];
    const feedUrl = `${baseUrl}/RssFeed/industry/${encodeURIComponent(config.code)}/feedTitle/${encodeURIComponent(`GlobeNewswire - Industry News on ${config.label}`)}`;

    const xml = await ofetch(feedUrl, { parseResponse: (txt) => txt });
    const $ = load(xml, { xmlMode: true });

    const items: DataItem[] = $('item')
        .toArray()
        .slice(0, limit)
        .map((el) => {
            const $item = $(el);
            const categories = $item
                .find(String.raw`dc\:subject, subject`)
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
        title: `GlobeNewsWire - ${config.label}`,
        link: `${baseUrl}/rss/list`,
        description: `GlobeNewsWire ${config.label} industry news releases`,
        item: items,
        language: 'en',
        view: ViewType.Articles,
    };
}
