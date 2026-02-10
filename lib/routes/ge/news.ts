import { load } from 'cheerio';

import type { Data, DataItem, Route } from '@/types';
import { ViewType } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const baseUrl = 'https://www.ge.com';

export const route: Route = {
    path: '/news',
    name: 'News',
    url: 'www.ge.com/news',
    maintainers: ['ChuYinan2023'],
    handler,
    example: '/ge/news',
    parameters: {},
    description: 'Latest press releases from GE.',
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
            source: ['www.ge.com/news', 'www.ge.com/news/press-releases'],
            target: '/news',
        },
    ],
    view: ViewType.Articles,
};

async function handler(): Promise<Data> {
    const listUrl = `${baseUrl}/news/press-releases`;
    const html = await ofetch(listUrl);
    const $ = load(html);

    // Deduplicate by link using Set
    const seen = new Set<string>();
    const listItems: Array<{ title: string; link: string; pubDate: ReturnType<typeof parseDate> | undefined }> = [];

    $('div.card_wrapper').each((_, el) => {
        const $el = $(el);
        const $a = $el.find('h4 a').first();
        const title = $a.text().trim();
        const href = $a.attr('href') || '';
        if (!title || !href) {
            return;
        }
        const link = href.startsWith('http') ? href : `${baseUrl}${href}`;
        if (seen.has(link)) {
            return;
        }
        seen.add(link);

        const dateAttr = $el.find('time').attr('datetime') || '';
        const pubDate = dateAttr ? parseDate(dateAttr) : undefined;

        listItems.push({ title, link, pubDate });
    });

    const items: DataItem[] = await Promise.all(
        listItems.slice(0, 20).map(async (item) => {
            // Only fetch detail for ge.com links (skip geaerospace.com etc.)
            if (!item.link.startsWith(baseUrl)) {
                return item as DataItem;
            }

            const cached = (await cache.tryGet(item.link, async () => {
                try {
                    const detailHtml = await ofetch(item.link);
                    const $d = load(detailHtml);
                    $d('script, style').remove();
                    return $d('section.ge-terms div.article-content').first().html()?.trim() || '';
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
        title: 'GE - Press Releases',
        link: listUrl,
        description: 'Latest press releases from GE.',
        item: items,
        language: 'en',
        view: ViewType.Articles,
    };
}
