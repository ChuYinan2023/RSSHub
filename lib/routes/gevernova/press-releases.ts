import { load } from 'cheerio';

import type { Data, DataItem, Route } from '@/types';
import { ViewType } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const baseUrl = 'https://www.gevernova.com';

export const route: Route = {
    path: '/press-releases',
    name: 'Press Releases',
    url: 'www.gevernova.com/news/media-hub',
    maintainers: ['ChuYinan2023'],
    handler,
    example: '/gevernova/press-releases',
    parameters: {},
    description: 'Latest press releases from GE Vernova.',
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
            source: ['www.gevernova.com/news/media-hub'],
            target: '/press-releases',
        },
    ],
    view: ViewType.Articles,
};

async function handler(): Promise<Data> {
    const listUrl = `${baseUrl}/news/media-hub?type%5Bpress_release%5D=press_release`;
    const html = await ofetch(listUrl);
    const $ = load(html);

    const listItems: Array<{
        title: string;
        link: string;
        pubDate?: ReturnType<typeof parseDate>;
        description: string;
    }> = [];

    $('div.pr-content-card').each((_, el) => {
        const $el = $(el);
        const $a = $el.find('a.card-wrapper').first();
        const href = $a.attr('href') || '';
        const title = $el.find('h5.card-title').text().trim();
        const datetime = $el.find('time').attr('datetime') || '';
        const excerpt = $el.find('div.info-text').text().trim();

        if (!title || !href) {
            return;
        }

        const link = href.startsWith('http') ? href : `${baseUrl}${href}`;

        listItems.push({
            title,
            link,
            pubDate: datetime ? parseDate(datetime) : undefined,
            description: excerpt,
        });
    });

    const items: DataItem[] = await Promise.all(
        listItems.map(async (item) => {
            const cached = (await cache.tryGet(item.link, async () => {
                try {
                    const detailHtml = await ofetch(item.link);
                    const $d = load(detailHtml);
                    $d('script, style').remove();
                    return $d('div.body-2.article-para').first().html()?.trim() || '';
                } catch {
                    return '';
                }
            })) as string;

            return {
                ...item,
                description: cached || item.description,
            } as DataItem;
        })
    );

    return {
        title: 'GE Vernova - Press Releases',
        link: `${baseUrl}/news/media-hub`,
        description: 'Latest press releases from GE Vernova.',
        item: items,
        language: 'en',
        view: ViewType.Articles,
    };
}
