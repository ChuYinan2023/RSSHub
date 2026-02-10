import { load } from 'cheerio';

import type { Data, DataItem, Route } from '@/types';
import { ViewType } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const baseUrl = 'https://www.novartis.com.cn';

export const route: Route = {
    path: '/cn/news/:type?',
    name: '新闻发布',
    url: 'www.novartis.com.cn',
    maintainers: ['ChuYinan2023'],
    handler,
    example: '/novartis/cn/news',
    parameters: {
        type: 'News type: `news` (Featured News), `media_release` (Media Release), `external_news` (In The News), `story_page` (Story). Defaults to all.',
    },
    description: 'Latest news from Novartis China.',
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
            source: ['www.novartis.com.cn/news/news-archive'],
            target: '/cn/news',
        },
    ],
    view: ViewType.Articles,
};

async function handler(ctx): Promise<Data> {
    const type = ctx.req.param('type');
    const listUrl = type ? `${baseUrl}/news/news-archive?type=${type}` : `${baseUrl}/news/news-archive`;
    const html = await ofetch(listUrl);
    const $ = load(html);

    const listItems = $('li.each-item')
        .toArray()
        .map((el) => {
            const $el = $(el);
            const $a = $el.find('a').first();
            const rawHref = $a.attr('href') || '';
            const link = rawHref.startsWith('http') ? rawHref : `${baseUrl}${rawHref}`;
            const title = $el.find('h3.views-field-title .field-content').text().trim();
            const datetime = $el.find('time.datetime').attr('datetime');
            const category = $el.find('.views-field-type .field-content').text().trim();

            return { title, link, datetime, category };
        })
        .filter((item) => item.title && item.link);

    const items: DataItem[] = await Promise.all(
        listItems.map(async (item) => {
            const description = (await cache.tryGet(item.link, async () => {
                const detailHtml = await ofetch(item.link);
                const $d = load(detailHtml);
                return $d('div.field--name-field-content').html()?.trim() || $d('div.field_body_txt').html()?.trim() || '';
            })) as string;

            return {
                title: item.title,
                link: item.link,
                description,
                pubDate: item.datetime ? parseDate(item.datetime) : undefined,
                category: item.category ? [item.category] : undefined,
            };
        })
    );

    return {
        title: '诺华中国 - 新闻发布',
        link: listUrl,
        description: '诺华集团中国新闻发布',
        item: items,
        language: 'zh-CN',
        view: ViewType.Articles,
    };
}
