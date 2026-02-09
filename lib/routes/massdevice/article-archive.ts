import type { Data, Route } from '@/types';
import got from '@/utils/got';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/article-archive',
    categories: ['new-media'],
    example: '/massdevice/article-archive',
    parameters: {},
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['www.massdevice.com/massdevice-article-archive/'],
            target: '/article-archive',
        },
    ],
    name: 'Article Archive',
    maintainers: ['ChuYinan2023'],
    handler,
    url: 'www.massdevice.com/massdevice-article-archive/',
};

async function handler(): Promise<Data> {
    const apiUrl = 'https://www.massdevice.com/wp-json/wp/v2/posts';
    const response = await got(apiUrl, {
        searchParams: {
            per_page: 20,
            _embed: true,
        },
    });

    const posts = response.data;

    const items = posts.map((post) => {
        const author = post._embedded?.author?.[0]?.name;
        const imageUrl = post._embedded?.['wp:featuredmedia']?.[0]?.source_url;
        const categories = post._embedded?.['wp:term']
            ?.flat()
            .filter((term) => term.taxonomy === 'category')
            .map((term) => term.name);

        return {
            title: post.title.rendered,
            link: post.link,
            description: post.content.rendered,
            pubDate: parseDate(post.date_gmt),
            author,
            image: imageUrl,
            category: categories,
        };
    });

    return {
        title: 'MassDevice - Article Archive',
        link: 'https://www.massdevice.com/massdevice-article-archive/',
        description: 'Latest medical device industry news from MassDevice',
        image: 'https://www.massdevice.com/wp-content/uploads/2023/05/cropped-massdevice-favicon-1-192x192.png',
        item: items,
    };
}
