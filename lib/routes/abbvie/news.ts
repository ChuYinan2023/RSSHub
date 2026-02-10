import { load } from 'cheerio';

import type { Data, DataItem, Route } from '@/types';
import { ViewType } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const baseUrl = 'https://news.abbvie.com';
const feedUrl = `${baseUrl}/index.php?s=2429&pagetemplate=rss`;

export const route: Route = {
    path: '/news',
    name: 'News Releases',
    url: 'news.abbvie.com',
    maintainers: ['ChuYinan2023'],
    handler,
    example: '/abbvie/news',
    parameters: {},
    description: 'Latest news releases from AbbVie.',
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
            source: ['news.abbvie.com/index.php?s=2429'],
            target: '/news',
        },
    ],
    view: ViewType.Articles,
};

async function handler(): Promise<Data> {
    const rssXml = await ofetch(feedUrl, { parseResponse: (txt) => txt });
    const $rss = load(rssXml, { xml: true });

    const rssItems = $rss('item')
        .toArray()
        .map((el) => ({
            title: $rss(el).find('title').text().trim(),
            link: $rss(el).find('link').text().trim(),
            pubDate: $rss(el).find('pubDate').text().trim(),
        }));

    const items: DataItem[] = await Promise.all(
        rssItems.map(async (entry) => {
            const cached = (await cache.tryGet(entry.link, async () => {
                const html = await ofetch(entry.link);
                const $ = load(html);

                const description = $('div.wd_body.wd_news_body').html()?.trim() || '';
                const categories: string[] = [];
                $('ul.wd_category_link_list li.wd_category_link a').each((_, el) => {
                    const tag = $(el).text().trim();
                    if (tag) {
                        categories.push(tag);
                    }
                });

                return JSON.stringify({ description, categories });
            })) as string;

            const { description, categories } = JSON.parse(cached);

            return {
                title: entry.title,
                link: entry.link,
                description,
                pubDate: entry.pubDate ? parseDate(entry.pubDate) : undefined,
                category: categories.length > 0 ? categories : undefined,
            };
        })
    );

    return {
        title: 'AbbVie - News Releases',
        link: `${baseUrl}/index.php?s=2429`,
        description: 'Latest news releases from AbbVie',
        item: items,
        language: 'en',
        view: ViewType.Articles,
    };
}
