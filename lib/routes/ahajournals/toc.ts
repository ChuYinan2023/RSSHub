import { load } from 'cheerio';

import type { Data, DataItem, Route } from '@/types';
import { ViewType } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const baseUrl = 'https://www.ahajournals.org';

const journalNames: Record<string, string> = {
    circ: 'Circulation',
    circep: 'Circulation: Arrhythmia and Electrophysiology',
    circheartfailure: 'Circulation: Heart Failure',
    circimaging: 'Circulation: Cardiovascular Imaging',
    circinterventions: 'Circulation: Cardiovascular Interventions',
    circoutcomes: 'Circulation: Cardiovascular Quality and Outcomes',
    circgen: 'Circulation: Genomic and Precision Medicine',
    atvb: 'Arteriosclerosis, Thrombosis, and Vascular Biology',
    hyp: 'Hypertension',
    str: 'Stroke',
    jaha: 'Journal of the American Heart Association',
};

export const route: Route = {
    path: '/toc/:journal',
    name: 'Latest Articles',
    url: 'www.ahajournals.org',
    maintainers: ['ChuYinan2023'],
    handler,
    example: '/ahajournals/toc/circ',
    parameters: {
        journal: 'Journal short name, see below for supported values',
    },
    description: `Latest articles from AHA Journals via native RSS feed.

| Journal | Code |
| --- | --- |
| Circulation | circ |
| Circ: Arrhythmia & Electrophysiology | circep |
| Circ: Heart Failure | circheartfailure |
| Circ: Cardiovascular Imaging | circimaging |
| Circ: Cardiovascular Interventions | circinterventions |
| Circ: Cardiovascular Quality & Outcomes | circoutcomes |
| Circ: Genomic & Precision Medicine | circgen |
| Arteriosclerosis, Thrombosis & Vascular Biology | atvb |
| Hypertension | hyp |
| Stroke | str |
| JAHA | jaha |`,
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
            source: ['www.ahajournals.org/toc/:journal/0/0'],
            target: '/toc/:journal',
        },
    ],
    view: ViewType.Articles,
};

async function handler(ctx): Promise<Data> {
    const journal = ctx.req.param('journal');
    const journalName = journalNames[journal] || journal;
    const feedUrl = `${baseUrl}/action/showFeed?type=etoc&feed=rss&jc=${journal}`;

    const xml = await ofetch(feedUrl);
    const $ = load(xml, { xmlMode: true });

    const items: DataItem[] = $('item')
        .toArray()
        .map((el) => {
            const $item = $(el);
            const title = $item.find('title').text().trim();
            const link = ($item.find('link').text().trim() || '').replace(/\?af=R$/, '');
            const doi =
                $item
                    .find(String.raw`prism\:doi, doi`)
                    .text()
                    .trim() || undefined;
            const description =
                $item
                    .find(String.raw`content\:encoded`)
                    .text()
                    .trim() || $item.find('description').text().trim();
            const dateStr =
                $item
                    .find(String.raw`dc\:date, date`)
                    .text()
                    .trim() ||
                $item
                    .find(String.raw`prism\:coverDate, coverDate`)
                    .text()
                    .trim();
            const pubDate = dateStr ? parseDate(dateStr) : undefined;
            const author =
                $item
                    .find(String.raw`dc\:creator, creator`)
                    .text()
                    .trim() || undefined;

            const categories: string[] = [];
            $item.find('SubjectTermTag').each((_, tag) => {
                const text = $(tag).text().trim();
                if (text) {
                    categories.push(text);
                }
            });

            return {
                title,
                link,
                pubDate,
                description,
                author,
                doi,
                category: categories.length > 0 ? categories : undefined,
            } as DataItem;
        });

    return {
        title: `${journalName} - Latest Articles`,
        link: `${baseUrl}/toc/${journal}/0/0`,
        description: `Latest articles from ${journalName}.`,
        item: items.slice(0, 40),
        language: 'en',
        view: ViewType.Articles,
    };
}
