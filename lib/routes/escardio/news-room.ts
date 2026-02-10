import { load } from 'cheerio';

import type { Data, DataItem, Route } from '@/types';
import { ViewType } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const baseUrl = 'https://www.escardio.org';

export const route: Route = {
    path: '/news-room',
    name: 'News Room',
    url: 'www.escardio.org/news/news-room/',
    maintainers: ['ChuYinan2023'],
    handler,
    example: '/escardio/news-room',
    parameters: {},
    description: 'Latest news from the ESC News Room including community and congress news.',
    categories: ['journal'],
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
            source: ['www.escardio.org/news/news-room/'],
            target: '/news-room',
        },
    ],
    view: ViewType.Articles,
};

async function handler(): Promise<Data> {
    // Fetch both community and congress news pages in parallel
    const [communityHtml, congressHtml] = await Promise.all([ofetch(`${baseUrl}/news/news-room/community-news/`), ofetch(`${baseUrl}/news/news-room/congress-news/`)]);

    const listItems: Array<{ title: string; link: string; pubDate?: ReturnType<typeof parseDate>; description?: string }> = [];

    // Parse community news (product-card style, no dates in listing)
    const $c = load(communityHtml);
    $c('div.card.product-card').each((_, el) => {
        const $el = $c(el);
        const $link = $el.find('h5.card-title a');
        const title = $link.text().trim();
        const href = $link.attr('href') || '';
        if (!title || !href) {
            return;
        }
        const link = href.startsWith('http') ? href : `${baseUrl}${href}`;
        const excerpt = $el.find('p.card-text').text().trim();

        // Skip self-referencing category links
        if (link.endsWith('/community-news/') || link.endsWith('/congress-news/')) {
            return;
        }

        listItems.push({ title, link, description: excerpt });
    });

    // Parse congress news (article-card style, with dates)
    const $g = load(congressHtml);
    $g('div.card.article-card').each((_, el) => {
        const $el = $g(el);
        const title = $el.find('h5.card-title').text().trim();
        const href = $el.find('a.stretched-link').attr('href') || '';
        if (!title || !href) {
            return;
        }
        const link = href.startsWith('http') ? href : `${baseUrl}${href}`;
        const dateText = $el.find('div.article-date small').text().trim();
        const excerpt = $el.find('p.card-text').text().trim();

        listItems.push({
            title,
            link,
            pubDate: dateText ? parseDate(dateText) : undefined,
            description: excerpt,
        });
    });

    // Deduplicate by link
    const seen = new Set<string>();
    const uniqueItems = listItems.filter((item) => {
        if (seen.has(item.link)) {
            return false;
        }
        seen.add(item.link);
        return true;
    });

    const items: DataItem[] = await Promise.all(
        uniqueItems.map(async (item) => {
            const cached = (await cache.tryGet(item.link, async () => {
                try {
                    const detailHtml = await ofetch(item.link);
                    const $d = load(detailHtml);

                    const description = $d('article.article-body').html()?.trim() || '';

                    // Extract date from detail page if not available from listing
                    let dateText = '';
                    if (!item.pubDate) {
                        // Date appears in a div.mb-2 right after the title
                        $d('div.mb-2').each((_, el) => {
                            const text = $d(el).text().trim();
                            if (/^\d{1,2}\s\w+,\s\d{4}$/.test(text)) {
                                dateText = text;
                            }
                        });
                    }

                    return JSON.stringify({ description, dateText });
                } catch {
                    return JSON.stringify({ description: '', dateText: '' });
                }
            })) as string;

            const { description, dateText } = JSON.parse(cached);

            return {
                title: item.title,
                link: item.link,
                description: description || item.description,
                pubDate: item.pubDate || (dateText ? parseDate(dateText) : undefined),
            } as DataItem;
        })
    );

    return {
        title: 'ESC - News Room',
        link: `${baseUrl}/news/news-room/`,
        description: 'Latest news from the European Society of Cardiology News Room.',
        item: items,
        language: 'en',
        view: ViewType.Articles,
    };
}
