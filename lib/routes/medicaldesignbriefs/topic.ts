import { load } from 'cheerio';

import type { Data, DataItem, Route } from '@/types';
import { ViewType } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const baseUrl = 'https://www.medicaldesignbriefs.com';

const topicMap: Record<string, string> = {
    'materials-manufacturing': 'Materials & Manufacturing',
    'design-testing': 'Design & Testing',
    'sensors-wearables': 'Sensors & Wearables',
    'electronics-software': 'Electronics & Software',
    'robotics-automation': 'Robotics & Automation',
    'iomt-connectivity': 'IoMT & Connectivity',
    techbriefs: 'Tech Briefs',
};

export const route: Route = {
    path: '/:topic?',
    name: 'Articles',
    url: 'www.medicaldesignbriefs.com',
    maintainers: ['ChuYinan2023'],
    handler,
    example: '/medicaldesignbriefs',
    parameters: {
        topic: {
            description: 'Topic slug, see table below. Defaults to all articles.',
            default: '',
            options: [
                { value: '', label: 'All' },
                {
                    value: 'materials-manufacturing',
                    label: 'Materials & Manufacturing',
                },
                { value: 'design-testing', label: 'Design & Testing' },
                { value: 'sensors-wearables', label: 'Sensors & Wearables' },
                {
                    value: 'electronics-software',
                    label: 'Electronics & Software',
                },
                {
                    value: 'robotics-automation',
                    label: 'Robotics & Automation',
                },
                { value: 'iomt-connectivity', label: 'IoMT & Connectivity' },
                { value: 'techbriefs', label: 'Tech Briefs' },
            ],
        },
    },
    description: `| Topic | Slug |
| --- | --- |
| All | (empty) |
| Materials & Manufacturing | materials-manufacturing |
| Design & Testing | design-testing |
| Sensors & Wearables | sensors-wearables |
| Electronics & Software | electronics-software |
| Robotics & Automation | robotics-automation |
| IoMT & Connectivity | iomt-connectivity |
| Tech Briefs | techbriefs |`,
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
            source: ['www.medicaldesignbriefs.com/mdb/topic/:topic'],
            target: '/:topic',
        },
        {
            source: ['www.medicaldesignbriefs.com/mdb/techbriefs'],
            target: '/techbriefs',
        },
        {
            source: ['www.medicaldesignbriefs.com/'],
            target: '',
        },
    ],
    view: ViewType.Articles,
};

async function handler(ctx): Promise<Data> {
    const topic = ctx.req.param('topic') || '';
    const limit = Number.parseInt(ctx.req.query('limit') || '20', 10);

    let feedUrl: string;
    let pageUrl: string;
    if (topic === 'techbriefs') {
        feedUrl = `${baseUrl}/mdb/techbriefs?format=feed&type=rss`;
        pageUrl = `${baseUrl}/mdb/techbriefs`;
    } else if (topic) {
        feedUrl = `${baseUrl}/mdb/topic/${topic}?format=feed&type=rss`;
        pageUrl = `${baseUrl}/mdb/topic/${topic}`;
    } else {
        feedUrl = `${baseUrl}/index.php?format=feed&type=rss`;
        pageUrl = baseUrl;
    }

    const xml = await ofetch(feedUrl, { parseResponse: (txt) => txt });
    const $ = load(xml, { xmlMode: true });

    let items: DataItem[] = $('item')
        .toArray()
        .slice(0, limit)
        .map((el) => {
            const $item = $(el);
            return {
                title: $item.find('title').text().trim(),
                link: $item.find('link').text().trim(),
                description: $item.find('description').text().trim(),
                pubDate: parseDate($item.find('pubDate').text().trim()),
            };
        });

    items = await Promise.all(
        items.map((item) =>
            cache.tryGet(item.link as string, async () => {
                const html = await ofetch(item.link as string);
                const $detail = load(html);

                const $body = $detail('article .article-body');
                if ($body.length) {
                    item.description = $body.html() || item.description;
                }

                const tags = $detail('a[href*="/component/ntb_tags/topic/"]')
                    .toArray()
                    .map((a) => $detail(a).text().trim())
                    .filter(Boolean);
                if (tags.length) {
                    item.category = tags;
                }

                return item;
            })
        )
    );

    const topicLabel = topic ? topicMap[topic] || topic : '';
    const feedTitle = topicLabel ? `Medical Design Briefs - ${topicLabel}` : 'Medical Design Briefs';

    return {
        title: feedTitle,
        link: pageUrl,
        description: 'Medical Design Briefs provides the engineering community with the latest technology and bio-medical breakthroughs.',
        item: items,
        language: 'en',
        view: ViewType.Articles,
    };
}
