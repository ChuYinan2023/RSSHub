import { load } from 'cheerio';

import type { Data, DataItem, Route } from '@/types';
import { ViewType } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const baseUrl = 'https://www.heart.org';

export const route: Route = {
    path: '/news',
    name: 'News',
    url: 'www.heart.org/en/news',
    maintainers: ['ChuYinan2023'],
    handler,
    example: '/heart/news',
    parameters: {},
    description: 'Latest news from the American Heart Association.',
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
            source: ['www.heart.org/en/news'],
            target: '/news',
        },
    ],
    view: ViewType.Articles,
};

async function handler(): Promise<Data> {
    const listUrl = `${baseUrl}/en/news`;
    const html = await ofetch(listUrl);
    const $ = load(html);

    const listItems = $('article.c-article-card--listing')
        .toArray()
        .map((el) => {
            const $el = $(el);
            const $link = $el.find('a.c-article-card__link');
            const href = $link.attr('href') || '';
            const title = $el.find('h2.c-article-card__title').text().trim();
            const dateText = $el.find('p.c-article-card__date').text().trim();
            const excerpt = $el.find('p.c-article-card__excerpt').text().trim();

            const categories: string[] = [];
            $el.find('p.c-article-card__metadata a').each((_, a) => {
                const tag = $(a).text().trim();
                if (tag) {
                    categories.push(tag);
                }
            });

            return {
                title,
                link: href.startsWith('http') ? href : `${baseUrl}${href}`,
                pubDate: dateText ? parseDate(dateText) : undefined,
                description: excerpt,
                category: categories.length > 0 ? categories : undefined,
            };
        });

    const items: DataItem[] = await Promise.all(
        listItems.map(async (item) => {
            const cached = (await cache.tryGet(item.link, async () => {
                try {
                    const detailHtml = await ofetch(item.link);
                    const $d = load(detailHtml);

                    // Remove social share section
                    $d('div.c-hero-card__social').remove();

                    return $d('div.l-article__main > div').first().html()?.trim() || '';
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
        title: 'American Heart Association - News',
        link: listUrl,
        description: 'Latest news from the American Heart Association on heart and brain health.',
        item: items,
        language: 'en',
        view: ViewType.Articles,
    };
}
