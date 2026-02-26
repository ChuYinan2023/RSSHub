import type { Data, DataItem, Route } from '@/types';
import { ViewType } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const apiBase = 'https://api.fda.gov/device/510k.json';
const baseUrl = 'https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpmn/pmn.cfm';

export const route: Route = {
    path: '/510k',
    name: '510(k) Premarket Notifications',
    url: 'www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpmn/pmn.cfm',
    maintainers: ['ChuYinan2023'],
    handler,
    example: '/fda/510k',
    description: 'Latest FDA 510(k) medical device clearances from the openFDA API.',
    categories: ['government'],
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
            source: ['www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpmn/pmn.cfm'],
            target: '/510k',
        },
    ],
    view: ViewType.Articles,
};

async function handler(ctx): Promise<Data> {
    const limit = Number.parseInt(ctx.req.query('limit') || '20', 10);

    const apiUrl = `${apiBase}?sort=decision_date:desc&limit=${limit}`;
    const response = await ofetch(apiUrl);

    const items: DataItem[] = response.results.map((r) => {
        const decisionDate = r.decision_date;
        const kNumber = r.k_number;
        const deviceName = r.device_name;
        const applicant = r.applicant;
        const specialty = r.advisory_committee_description || '';
        const decision = r.decision_description || '';
        const clearanceType = r.clearance_type || '';
        const productCode = r.product_code || '';

        const description = [
            `<p><b>K Number:</b> ${kNumber}</p>`,
            `<p><b>Device:</b> ${deviceName}</p>`,
            `<p><b>Applicant:</b> ${applicant}</p>`,
            `<p><b>Decision:</b> ${decision}</p>`,
            `<p><b>Decision Date:</b> ${decisionDate}</p>`,
            clearanceType ? `<p><b>Clearance Type:</b> ${clearanceType}</p>` : '',
            specialty ? `<p><b>Advisory Committee:</b> ${specialty}</p>` : '',
            productCode ? `<p><b>Product Code:</b> ${productCode}</p>` : '',
        ]
            .filter(Boolean)
            .join('');

        return {
            title: `${kNumber}: ${deviceName} (${applicant})`,
            link: `${baseUrl}?ID=${kNumber}`,
            pubDate: parseDate(decisionDate),
            description,
            author: applicant,
            category: specialty ? [specialty] : undefined,
        };
    });

    return {
        title: 'FDA 510(k) Premarket Notifications',
        link: baseUrl,
        description: 'Latest FDA 510(k) medical device clearances.',
        item: items,
        language: 'en',
        view: ViewType.Articles,
    };
}
