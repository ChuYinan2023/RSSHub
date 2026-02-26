import type { Data, DataItem, Route } from '@/types';
import { ViewType } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const baseUrl = 'https://www.edwards.com';
const kontentProjectId = '6239a81e-8f0f-0040-a1df-b4932a10f6ae';
const kontentApiBase = `https://deliver.kontent.ai/${kontentProjectId}`;

export const route: Route = {
    path: '/press-releases',
    name: 'Press Releases',
    url: 'www.edwards.com/newsroom/press-releases',
    maintainers: ['ChuYinan2023'],
    handler,
    example: '/edwards/press-releases',
    description: 'Edwards Lifesciences press releases from the newsroom.',
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
            source: ['www.edwards.com/newsroom/press-releases'],
            target: '/press-releases',
        },
        {
            source: ['www.edwards.com/newsroom'],
            target: '/press-releases',
        },
    ],
    view: ViewType.Articles,
};

async function handler(ctx): Promise<Data> {
    const limit = Number.parseInt(ctx.req.query('limit') || '20', 10);

    const apiUrl = `${kontentApiBase}/items?system.type=press_release&limit=${limit}&order=elements.date[desc]`;
    const response = await ofetch(apiUrl);

    const items: DataItem[] = await Promise.all(
        response.items.map((item) => {
            const elements = item.elements;
            const title = elements.title.value;
            const slug = elements.url_slug.value;
            const link = `${baseUrl}/${slug}`;
            const pubDate = parseDate(elements.date.value);

            return cache.tryGet(link, async () => {
                let description = '';

                const bodyAssets = elements.body.value;
                if (bodyAssets.length > 0) {
                    const bodyJson = await ofetch(bodyAssets[0].url);
                    description = bodyJson.body || '';
                }

                return {
                    title,
                    link,
                    pubDate,
                    description,
                };
            }) as Promise<DataItem>;
        })
    );

    return {
        title: 'Edwards Lifesciences - Press Releases',
        link: `${baseUrl}/newsroom/press-releases`,
        description: 'Edwards Lifesciences is the leading global structural heart innovation company, driven by a passion to improve patient lives.',
        item: items,
        language: 'en',
        view: ViewType.Articles,
    };
}
